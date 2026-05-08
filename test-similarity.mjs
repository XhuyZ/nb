// Temporary debug script – run with: node test-similarity.mjs
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
const traverse = _traverse.default ?? _traverse;

function extractAstFeatures(code) {
    try {
        const ast = parse(code, {
            sourceType: 'unambiguous',
            plugins: ['typescript', 'jsx'],
            errorRecovery: true,
        });
        const identifiers = new Set();
        const nodeTypes = new Set();
        const structureSeq = [];

        traverse(ast, {
            enter(path) {
                const type = path.node.type;
                nodeTypes.add(type);
                structureSeq.push(type);
                if ('name' in path.node && typeof path.node.name === 'string') {
                    identifiers.add(path.node.name);
                }
            },
        });
        return { identifiers: [...identifiers], nodeTypes: [...nodeTypes], structureSeq };
    } catch (e) {
        console.error('Parse error:', e.message);
        return { identifiers: [], nodeTypes: [], structureSeq: [] };
    }
}

function normalizeCode(code) {
    return code
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, ' ')
        .split(' ')
        .filter((t) => t.length > 1);
}

function stripComments(code) {
    return code
        .replace(/\/\/[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');
}

function computeSimilarity(a, b, stripCommentsBefore = false) {
    const ca = stripCommentsBefore ? stripComments(a) : a;
    const cb = stripCommentsBefore ? stripComments(b) : b;

    const astA = extractAstFeatures(ca);
    const astB = extractAstFeatures(cb);

    const tokensA = new Set([...normalizeCode(ca), ...astA.nodeTypes]);
    const tokensB = new Set([...normalizeCode(cb), ...astB.nodeTypes]);

    let tokenIntersection = 0;
    tokensA.forEach((t) => { if (tokensB.has(t)) tokenIntersection++; });
    const tokenUnion = new Set([...tokensA, ...tokensB]).size;
    const tokenSim = tokenUnion === 0 ? 0 : tokenIntersection / tokenUnion;

    const getTrigrams = (seq) => {
        if (seq.length < 3) return seq;
        const tris = [];
        for (let i = 0; i < seq.length - 2; i++) {
            tris.push(`${seq[i]}-${seq[i + 1]}-${seq[i + 2]}`);
        }
        return tris;
    };
    const triA = getTrigrams(astA.structureSeq);
    const triB = getTrigrams(astB.structureSeq);
    const setTriB = new Set(triB);
    let triInter = 0;
    const uniqueTriA = new Set(triA);
    uniqueTriA.forEach(t => { if (setTriB.has(t)) triInter++; });
    const triUnion = new Set([...triA, ...triB]).size;
    const structSim = triUnion === 0
        ? (triA.length === triB.length && triA.length > 0 ? 1 : 0)
        : triInter / triUnion;

    const sim = Number((0.3 * tokenSim + 0.7 * structSim).toFixed(4));
    return { tokenSim: +tokenSim.toFixed(4), structSim: +structSim.toFixed(4), sim };
}

const v1 = `function solve(input){
    let numbers = input.trim().split(/\\s+/).map(Number);
    let total = 0;
    for (let index = 0; index < numbers.length; index++) {
        total = total + numbers[index];
    }
    return total;
}`;

const v2 = `function solve(data) {
    // Tách chuỗi input thành mảng số
    let values = data.trim().split(/\\s+/).map(Number);
    // Biến lưu kết quả tổng
    let sumResult = 0;
    // Duyệt từng phần tử và cộng dồn
    for (let i = 0; i < values.length; i++) {
        sumResult += values[i];
    }
    // Trả về tổng cuối cùng
    return sumResult;
}`;

const v3 = `function solve(rawInput) {
    // Chuyển dữ liệu đầu vào thành danh sách số nguyên
    const arrNumbers = rawInput
        .trim()
        .split(/\\s+/)
        .map(Number);
    // Khởi tạo biến accumulator
    let accumulator = 0;
    // Cộng tất cả phần tử trong mảng
    for (let position = 0; position < arrNumbers.length; position++) {
        accumulator = accumulator + arrNumbers[position];
    }
    // Output kết quả
    return accumulator;
}`;

console.log('=== WITHOUT comment stripping ===');
console.log('v1 vs v2:', computeSimilarity(v1, v2, false));
console.log('v1 vs v3:', computeSimilarity(v1, v3, false));
console.log('v2 vs v3:', computeSimilarity(v2, v3, false));

console.log('\n=== WITH comment stripping ===');
console.log('v1 vs v2:', computeSimilarity(v1, v2, true));
console.log('v1 vs v3:', computeSimilarity(v1, v3, true));
console.log('v2 vs v3:', computeSimilarity(v2, v3, true));
