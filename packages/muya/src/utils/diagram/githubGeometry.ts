type TPoint = [number, number, number];
interface IShape { points: TPoint[]; closed: boolean; holes?: TPoint[][] }

const SVG_NS = 'http://www.w3.org/2000/svg';
const MAX_POINTS = 100000;

function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Expected a geometry object');
    return value as Record<string, unknown>;
}

function array(value: unknown): unknown[] {
    if (!Array.isArray(value))
        throw new Error('Expected coordinates');
    return value;
}

function point(value: unknown): TPoint {
    const coords = array(value);
    if (coords.length < 2 || !coords.every(n => typeof n === 'number' && Number.isFinite(n)))
        throw new Error('Coordinates must contain finite numbers');
    return [Number(coords[0]), Number(coords[1]), Number(coords[2] ?? 0)];
}

function geoShapes(value: unknown, shapes: IShape[], depth = 0) {
    if (depth > 32)
        throw new Error('Geometry nesting is too deep');
    const geo = object(value);
    const line = (coords: unknown, closed = false) => shapes.push({ points: array(coords).map(point), closed });
    switch (geo.type) {
        case 'FeatureCollection':
            array(geo.features).forEach(feature => geoShapes(feature, shapes, depth + 1));
            break;
        case 'Feature':
            if (geo.geometry !== null)
                geoShapes(geo.geometry, shapes, depth + 1);
            break;
        case 'GeometryCollection':
            array(geo.geometries).forEach(g => geoShapes(g, shapes, depth + 1));
            break;
        case 'Point':
            line([geo.coordinates]);
            break;
        case 'MultiPoint':
            array(geo.coordinates).forEach(p => line([p]));
            break;
        case 'LineString':
            line(geo.coordinates);
            break;
        case 'MultiLineString':
            array(geo.coordinates).forEach(coords => line(coords));
            break;
        case 'Polygon': {
            const rings = array(geo.coordinates).map(coords => array(coords).map(point));
            if (rings.length)
                shapes.push({ points: rings[0], closed: true, holes: rings.slice(1) });
            break;
        }
        case 'MultiPolygon':
            array(geo.coordinates).forEach(coordinates => geoShapes({ type: 'Polygon', coordinates }, shapes, depth + 1));
            break;
        default:
            throw new Error('Unsupported GeoJSON geometry');
    }
}

function topologyShapes(value: unknown): IShape[] {
    const topology = object(value);
    if (topology.type !== 'Topology')
        throw new Error('Expected a TopoJSON Topology');
    const transform = topology.transform ? object(topology.transform) : null;
    const scale = transform ? point(transform.scale) : [1, 1];
    const translate = transform ? point(transform.translate) : [0, 0];
    const transformPoint = (p: TPoint): TPoint => [p[0] * scale[0] + translate[0], p[1] * scale[1] + translate[1], 0];
    const arcs = array(topology.arcs).map((arc) => {
        let x = 0;
        let y = 0;
        return array(arc).map((coords) => {
            const p = point(coords);
            if (!transform)
                return p;
            x += p[0];
            y += p[1];
            return transformPoint([x, y, 0]);
        });
    });
    const join = (indices: unknown): TPoint[] => {
        const result: TPoint[] = [];
        for (const index of array(indices)) {
            if (typeof index !== 'number' || !Number.isInteger(index))
                throw new Error('Invalid TopoJSON arc index');
            const arc = arcs[index < 0 ? ~index : index];
            if (!arc)
                throw new Error('Missing TopoJSON arc');
            const points = index < 0 ? [...arc].reverse() : arc;
            result.push(...(result.length ? points.slice(1) : points));
            if (result.length > MAX_POINTS)
                throw new Error('Map has too many coordinates');
        }
        return result;
    };
    const shapes: IShape[] = [];
    const visit = (value: unknown, depth = 0) => {
        if (depth > 32)
            throw new Error('Geometry nesting is too deep');
        const geo = object(value);
        if (geo.type === 'GeometryCollection') {
            array(geo.geometries).forEach(g => visit(g, depth + 1));
            return;
        }
        let coordinates: unknown;
        switch (geo.type) {
            case 'Point':
                coordinates = transformPoint(point(geo.coordinates));
                break;
            case 'MultiPoint':
                coordinates = array(geo.coordinates).map(p => transformPoint(point(p)));
                break;
            case 'LineString':
                coordinates = join(geo.arcs);
                break;
            case 'MultiLineString':
            case 'Polygon':
                coordinates = array(geo.arcs).map(join);
                break;
            case 'MultiPolygon':
                coordinates = array(geo.arcs).map(p => array(p).map(join));
                break;
            default: throw new Error('Unsupported TopoJSON geometry');
        }
        geoShapes({ type: geo.type, coordinates }, shapes);
    };
    Object.values(object(topology.objects)).forEach(g => visit(g));
    return shapes;
}

function svgElement<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string> = {}): SVGElementTagNameMap[K] {
    const element = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
    return element;
}

function canvas(target: HTMLElement, title: string) {
    const svg = svgElement('svg', { 'viewBox': '0 0 800 480', 'width': '800', 'height': '480', 'role': 'img', 'aria-label': title, 'tabindex': '0' });
    const label = svgElement('title');
    label.textContent = title;
    svg.append(label, svgElement('rect', { width: '800', height: '480', fill: '#f6f8fa' }));
    target.replaceChildren(svg);
    target.classList.add('github-geometry');
    // The editor normally focuses a diagram's source on click. Geometry
    // gestures must keep focus on the interactive preview instead.
    svg.addEventListener('click', event => event.stopPropagation());
    return svg;
}

function mapPoints(type: string, code: string): IShape[] {
    const value: unknown = JSON.parse(code);
    const shapes: IShape[] = [];
    if (type === 'topojson')
        shapes.push(...topologyShapes(value));
    else
        geoShapes(value, shapes);
    const points = shapes.flatMap(shape => [...shape.points, ...(shape.holes ?? []).flat()]);
    if (!points.length || points.length > MAX_POINTS)
        throw new Error('Map must contain between 1 and 100000 coordinates');
    if (points.some(p => Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90))
        throw new Error('Map coordinates must be longitude and latitude');
    return shapes;
}

function renderMap(type: string, code: string, target: HTMLElement) {
    const shapes = mapPoints(type, code);
    const points = shapes.flatMap(shape => [...shape.points, ...(shape.holes ?? []).flat()]);
    let minX = 180;
    let minY = 90;
    let maxX = -180;
    let maxY = -90;
    for (const [x, y] of points) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
    }
    const scale = Math.min(720 / Math.max(maxX - minX, 1), 400 / Math.max(maxY - minY, 1));
    const project = ([x, y]: TPoint) => [400 + (x - (minX + maxX) / 2) * scale, 240 - (y - (minY + maxY) / 2) * scale];
    const svg = canvas(target, `${type} map. Drag to pan, scroll to zoom.`);
    for (let x = 0; x <= 800; x += 80)
        svg.append(svgElement('path', { 'd': `M${x} 0V480`, 'stroke': '#d0d7de', 'stroke-width': '0.5' }));
    for (let y = 0; y <= 480; y += 80)
        svg.append(svgElement('path', { 'd': `M0 ${y}H800`, 'stroke': '#d0d7de', 'stroke-width': '0.5' }));
    for (const shape of shapes) {
        const coords = shape.points.map(project);
        if (!coords.length)
            continue;
        if (coords.length === 1) {
            svg.append(svgElement('circle', { cx: String(coords[0][0]), cy: String(coords[0][1]), r: '5', fill: '#8250df' }));
        }
        else {
            const rings = [coords, ...(shape.holes ?? []).map(ring => ring.map(project))];
            const d = rings.map(ring => ring.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ') + (shape.closed ? 'Z' : '')).join(' ');
            svg.append(svgElement('path', { d, 'fill': shape.closed ? '#8250df44' : 'none', 'stroke': '#8250df', 'stroke-width': '2', 'fill-rule': 'evenodd', 'vector-effect': 'non-scaling-stroke' }));
        }
    }
    let view = [0, 0, 800, 480];
    let anchor: number[] | null = null;
    const update = () => svg.setAttribute('viewBox', view.join(' '));
    svg.addEventListener('wheel', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const factor = event.deltaY > 0 ? 1.2 : 1 / 1.2;
        if (view[2] * factor < 10 || view[2] * factor > 8000)
            return;
        view = [view[0] + view[2] * (1 - factor) / 2, view[1] + view[3] * (1 - factor) / 2, view[2] * factor, view[3] * factor];
        update();
    }, { passive: false });
    svg.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        anchor = [event.clientX, event.clientY];
        svg.setPointerCapture(event.pointerId);
    });
    svg.addEventListener('pointermove', (event) => {
        if (!anchor)
            return;
        const width = svg.getBoundingClientRect().width || 800;
        view[0] -= (event.clientX - anchor[0]) * view[2] / width;
        view[1] -= (event.clientY - anchor[1]) * view[2] / width;
        anchor = [event.clientX, event.clientY];
        update();
    });
    svg.addEventListener('pointerup', () => {
        anchor = null;
    });
    svg.addEventListener('lostpointercapture', () => {
        anchor = null;
    });
}

function stlTriangles(code: string): TPoint[][] {
    const lines = code.trim().split(/\r?\n/);
    if (!/^solid(?:\s|$)/.test(lines[0]) || !/^\s*endsolid(?:\s|$)/.test(lines[lines.length - 1]))
        throw new Error('Expected an ASCII STL solid');
    const body = lines.slice(1, -1).join('\n');
    const number = '([-+]?(?:\\d+\\.\\d*|\\d+|\\.\\d+)(?:[eE][-+]?\\d+)?)';
    const vector = `${number}\\s+${number}\\s+${number}`;
    const facet = new RegExp(`facet\\s+normal\\s+${vector}\\s+outer\\s+loop\\s+vertex\\s+${vector}\\s+vertex\\s+${vector}\\s+vertex\\s+${vector}\\s+endloop\\s+endfacet`, 'g');
    const faces = [...body.matchAll(facet)].map((match) => {
        const n = match.slice(1).map(Number);
        if (!n.every(Number.isFinite))
            throw new Error('STL vertices must be finite');
        return [[n[3], n[4], n[5]], [n[6], n[7], n[8]], [n[9], n[10], n[11]]] as TPoint[];
    });
    if (!faces.length || faces.length > MAX_POINTS / 3 || body.replace(facet, '').trim())
        throw new Error('Invalid ASCII STL facets');
    return faces;
}

function renderStl(code: string, target: HTMLElement) {
    const triangles = stlTriangles(code);
    const points = triangles.flat();
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const p of points) {
        p.forEach((n, i) => {
            min[i] = Math.min(min[i], n);
            max[i] = Math.max(max[i], n);
        });
    }
    const center = min.map((n, i) => n / 2 + max[i] / 2);
    const radius = Math.max(...max.map((n, i) => n - min[i]));
    if (!Number.isFinite(radius) || radius === 0)
        throw new Error('STL model has no finite extent');
    const svg = canvas(target, 'STL model. Drag or use arrow keys to rotate. Double-click to toggle wireframe.');
    const group = svgElement('g');
    svg.append(group);
    let yaw = -0.6;
    let pitch = 0.5;
    let wireframe = false;
    const draw = () => {
        const rotate = (p: TPoint): TPoint => {
            const [x, y, z] = p.map((n, i) => (n - center[i]) / radius);
            const rx = x * Math.cos(yaw) + z * Math.sin(yaw);
            const rz = z * Math.cos(yaw) - x * Math.sin(yaw);
            return [rx, y * Math.cos(pitch) - rz * Math.sin(pitch), y * Math.sin(pitch) + rz * Math.cos(pitch)];
        };
        const faces = triangles.map(t => t.map(rotate)).sort((a, b) => a.reduce((n, p) => n + p[2], 0) - b.reduce((n, p) => n + p[2], 0));
        group.replaceChildren(...faces.map((face) => {
            const a = face[1].map((n, i) => n - face[0][i]);
            const b = face[2].map((n, i) => n - face[0][i]);
            const shade = Math.round(45 + 25 * Math.abs(a[0] * b[1] - a[1] * b[0]));
            return svgElement('polygon', {
                'points': face.map(p => `${400 + p[0] * 300},${240 - p[1] * 300}`).join(' '),
                'fill': wireframe ? 'none' : `hsl(212,65%,${Math.min(shade, 80)}%)`,
                'stroke': '#0550ae',
                'stroke-width': '0.7',
            });
        }));
    };
    let anchor: number[] | null = null;
    svg.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        anchor = [event.clientX, event.clientY];
        svg.setPointerCapture(event.pointerId);
    });
    svg.addEventListener('pointermove', (event) => {
        if (!anchor)
            return;
        yaw += (event.clientX - anchor[0]) * 0.01;
        pitch += (event.clientY - anchor[1]) * 0.01;
        anchor = [event.clientX, event.clientY];
        draw();
    });
    svg.addEventListener('pointerup', () => {
        anchor = null;
    });
    svg.addEventListener('lostpointercapture', () => {
        anchor = null;
    });
    svg.addEventListener('dblclick', (event) => {
        event.stopPropagation();
        wireframe = !wireframe;
        draw();
    });
    svg.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key))
            return;
        event.preventDefault();
        event.stopPropagation();
        yaw += event.key === 'ArrowLeft' ? -0.1 : event.key === 'ArrowRight' ? 0.1 : 0;
        pitch += event.key === 'ArrowUp' ? -0.1 : event.key === 'ArrowDown' ? 0.1 : 0;
        draw();
    });
    draw();
}

export function renderGithubGeometry(type: string, code: string, target: HTMLElement) {
    if (code.length > 2000000)
        throw new Error('Geometry source exceeds 2 MB');
    if (type === 'stl')
        renderStl(code, target);
    else
        renderMap(type, code, target);
}
