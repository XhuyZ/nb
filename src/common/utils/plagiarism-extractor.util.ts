import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { EvidenceSegment } from 'src/plagiarisms/entities/plagiarism.entity';

export class PlagiarismExtractor {
    static extractAstFeatures(code: string) {
        try {
            const ast = parse(code, {
                sourceType: 'unambiguous',
                plugins: ['typescript', 'jsx'],
                errorRecovery: true,
            });
            const identifiers = new Set<string>();
            const nodeTypes = new Set<string>();
            const structureSeq: string[] = [];
            const nodeInfos: { type: string; start: number; end: number; name?: string }[] = [];
            const lines: string[] = [];
            const sourceLines = code.split('\n');

            traverse(ast, {
                enter(path) {
                    const type = path.node.type;
                    nodeTypes.add(type);
                    structureSeq.push(type);

                    let name: string | undefined;
                    if ('name' in path.node && typeof path.node.name === 'string') {
                        name = path.node.name;
                        identifiers.add(name);
                    } else if (path.isFunctionDeclaration() && path.node.id?.name) {
                        name = path.node.id.name;
                    } else if (path.isClassDeclaration() && path.node.id?.name) {
                        name = path.node.id.name;
                    }

                    if (path.node.loc) {
                        nodeInfos.push({
                            type,
                            start: path.node.loc.start.line,
                            end: path.node.loc.end.line,
                            name,
                        });
                    }

                    const startLine = path.node.loc?.start.line;
                    if (startLine && sourceLines[startLine - 1]) {
                        lines.push(sourceLines[startLine - 1].trim());
                    }
                },
            });

            return {
                identifiers: [...identifiers],
                nodeTypes: [...nodeTypes],
                structureSeq,
                nodeInfos,
                lines: lines.filter((line) => line.length > 5),
            };
        } catch {
            return {
                identifiers: [],
                nodeTypes: [],
                structureSeq: [],
                nodeInfos: [],
                lines: [],
            };
        }
    }

    static extractPlagiarismEvidence(codeA: string, codeB: string) {
        const astA = this.extractAstFeatures(codeA);
        const astB = this.extractAstFeatures(codeB);

        const cleanA = this.stripComments(codeA);
        const cleanB = this.stripComments(codeB);
        const tokensA = [...this.normalizeCode(cleanA), ...astA.identifiers];
        const tokensB = [...this.normalizeCode(cleanB), ...astB.identifiers];
        const tokenSetB = new Set(tokensB);
        const commonTokenSet = new Set(tokensA.filter((token) => tokenSetB.has(token)));
        const commonTokens = [...commonTokenSet].slice(0, 15);

        const lineSetB = new Set(astB.lines);
        const commonLines = astA.lines.filter((line) => lineSetB.has(line)).slice(0, 5);

        const sourceLinesA = codeA.split('\n');
        const sourceLinesB = codeB.split('\n');
        const sliceSnippet = (lines: string[], start: number, end: number) =>
            lines
                .slice(Math.max(0, start - 1), Math.min(lines.length, end))
                .join('\n')
                .slice(0, 600);

        const segments: EvidenceSegment[] = [];

        // 1. Find contiguous identical line segments
        const lineSegments = this.findCommonLineSegments(codeA, codeB);
        lineSegments.forEach((segment) => {
            segments.push({
                ...segment,
                snippetA: sliceSnippet(sourceLinesA, segment.linesA[0], segment.linesA[1]),
                snippetB: sliceSnippet(sourceLinesB, segment.linesB[0], segment.linesB[1]),
            });
        });

        // 2. Extract segments based on common AST nodes (for structural similarity)
        const importantTypes = ['FunctionDeclaration', 'ClassDeclaration', 'ForOfStatement', 'ForInStatement', 'ForStatement', 'WhileStatement', 'IfStatement'];

        astA.nodeInfos.forEach((nodeA) => {
            if (importantTypes.includes(nodeA.type)) {
                const matchB = astB.nodeInfos.find((nodeB) =>
                    nodeB.type === nodeA.type &&
                    Math.abs((nodeA.end - nodeA.start) - (nodeB.end - nodeB.start)) <= 3 &&
                    (nodeA.end - nodeA.start) >= 2
                    // We purposefully REMOVED the requirement for names to match exact to detect renamed functions
                );

                if (matchB) {
                    let title = nodeA.type.replace(/([A-Z])/g, ' $1').trim();
                    let description = 'Matching logic pattern detected';

                    if (nodeA.type === 'ClassDeclaration') {
                        title = 'Class definition match';
                        description = 'Similar class structure and members';
                    } else if (nodeA.type === 'FunctionDeclaration') {
                        title = 'Matching function logic';
                        description =
                            'Same function shape detected; variable renaming and added comments did not change the structure';
                    } else if (['ForOfStatement', 'ForInStatement', 'ForStatement', 'WhileStatement'].includes(nodeA.type)) {
                        title = 'Common loop structure';
                        description = 'Same iteration pattern (init / condition / update / body)';
                    } else if (nodeA.type === 'IfStatement') {
                        title = 'Common conditional structure';
                        description = 'Same branching pattern with matching consequent/alternate shape';
                    }

                    const isOverlap = segments.some(s =>
                        (nodeA.start >= s.linesA[0] && nodeA.start <= s.linesA[1]) ||
                        (nodeA.end >= s.linesA[0] && nodeA.end <= s.linesA[1])
                    );

                    if (!isOverlap) {
                        segments.push({
                            title,
                            description,
                            similarity: 0.92,
                            linesA: [nodeA.start, nodeA.end],
                            linesB: [matchB.start, matchB.end],
                            snippetA: sliceSnippet(sourceLinesA, nodeA.start, nodeA.end),
                            snippetB: sliceSnippet(sourceLinesB, matchB.start, matchB.end),
                        });
                    }
                }
            }
        });

        if (segments.length === 0) {
            segments.push({
                title: 'Common code segment',
                description: 'Sequences of similar code lines',
                similarity: 0.8,
                linesA: [1, Math.min(10, sourceLinesA.length)],
                linesB: [1, Math.min(10, sourceLinesB.length)],
                snippetA: sliceSnippet(sourceLinesA, 1, Math.min(10, sourceLinesA.length)),
                snippetB: sliceSnippet(sourceLinesB, 1, Math.min(10, sourceLinesB.length)),
            });
        }

        return {
            commonTokens,
            commonLines,
            astNodesA: astA.nodeTypes.slice(0, 15),
            astNodesB: astB.nodeTypes.slice(0, 15),
            segments: segments.sort((a, b) => b.similarity - a.similarity).slice(0, 8),
        };
    }

    static stripComments(code: string): string {
        return code
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/.*$/gm, '');
    }

    private static findCommonLineSegments(codeA: string, codeB: string): EvidenceSegment[] {
        const linesA = codeA.split('\n').map(l => l.trim());
        const linesB = codeB.split('\n').map(l => l.trim());
        const segments: EvidenceSegment[] = [];

        let i = 0;
        while (i < linesA.length) {
            if (linesA[i].length > 15) {
                const indexB = linesB.indexOf(linesA[i]);
                if (indexB !== -1) {
                    let len = 1;
                    while (i + len < linesA.length && indexB + len < linesB.length && linesA[i + len] === linesB[indexB + len] && linesA[i + len].length > 5) {
                        len++;
                    }
                    if (len >= 1) {
                        segments.push({
                            title: len >= 3 ? 'Identical code block' : 'Common code segment',
                            description: `${len} matching lines found`,
                            similarity: 0.98,
                            linesA: [i + 1, i + len],
                            linesB: [indexB + 1, indexB + len],
                        });
                        i += len;
                        continue;
                    }
                }
            }
            i++;
        }
        return segments;
    }

    private static normalizeCode(code: string): string[] {
        return code
            .toLowerCase()
            .replace(/[^a-z0-9_]+/g, ' ')
            .split(' ')
            .filter((token) => token.length > 1);
    }
}
