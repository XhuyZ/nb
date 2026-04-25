
const API_BASE = 'http://localhost:3000';

async function api(path, method = 'GET', body = null, token = null) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let options = { method, headers };

    if (body instanceof FormData) {
        options.body = body;
    } else if (body) {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    const res = await fetch(`${API_BASE}${path}`, options);
    const data = await res.json();
    if (!res.ok) {
        console.error(`Error ${res.status} on ${method} ${path}:`, data);
        throw new Error(data.message || 'API Error');
    }
    return data;
}

async function runTest() {
    console.log('--- STARTING SIMILARITY UPDATE VERIFICATION ---');

    const teacherToken = (await api('/auth/login', 'POST', { username: 'teacher1', password: '123456' })).data.access_token;
    const s1Token = (await api('/auth/login', 'POST', { username: 'student1', password: '123456' })).data.access_token;
    const s2Token = (await api('/auth/login', 'POST', { username: 'student2', password: '123456' })).data.access_token;

    console.log('Setup course and assignment...');
    const course = (await api('/courses', 'POST', { name: 'Update Test Course', description: 'Testing similarity update' }, teacherToken)).data;
    const chapter = (await api(`/courses/${course.id}/chapters`, 'POST', { title: 'Chapter 1', orderIndex: 1 }, teacherToken)).data;

    const formData = new FormData();
    formData.append('title', 'Similarity Update Assignment');
    formData.append('chapterId', chapter.id);
    formData.append('description', 'Test');
    formData.append('status', 'open');
    const assignment = (await api('/assignments', 'POST', formData, teacherToken)).data;

    await api(`/courses/${course.id}/enroll`, 'POST', {}, s1Token);
    await api(`/courses/${course.id}/enroll`, 'POST', {}, s2Token);

    const codeA = `
    /** Original implementation by Student 1 */
    function solveComplexProblem(items) {
      let result = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.value > 100) {
          result.push({ id: item.id, score: item.value * 1.5 });
        }
      }
      return result.sort((a, b) => b.score - a.score);
    }
    `;
    const codeB = `
    /** Plagiarized implementation by Student 2 */
    function solveComplexProblem(data) {
      let output = [];
      for (let j = 0; j < data.length; j++) {
        const entry = data[j];
        if (entry.value > 100) {
          output.push({ id: entry.id, score: entry.value * 1.5 });
        }
      }
      return output.sort((x, y) => y.score - x.score);
    }
    `;
    const codeC = `
    /** Improved implementation by Student 2 (Original) */
    function solveComplexProblem(items) {
      return items
        .filter(i => i.value > 100)
        .map(i => ({ id: i.id, score: i.value * 1.5 }))
        .sort((a, b) => b.score - a.score);
    }
    `;

    console.log('Student 1 submits original code...');
    await api('/submissions', 'POST', { assignmentId: assignment.id, code: codeA }, s1Token);

    console.log('Student 2 submits PLAGIARIZED code (Version 1)...');
    const sub2 = (await api('/submissions', 'POST', { assignmentId: assignment.id, code: codeB }, s2Token)).data;

    console.log('Waiting for plagiarism detection (v1)...');
    await new Promise(r => setTimeout(r, 10000));

    let statusV1 = await api(`/submissions/${sub2.id}`, 'GET', null, teacherToken);
    console.log('Submission Status V1:', JSON.stringify(statusV1.data, null, 2).substring(0, 500));
    console.log('Similarity V1:', statusV1.data.highestSimilarity);

    if (!statusV1.data.highestSimilarity) {
        console.warn('WARNING: Similarity is still null. Maybe check server logs?');
    }

    console.log('Student 2 submits IMPROVED code (Version 2)...');
    await api('/submissions', 'POST', { assignmentId: assignment.id, code: codeC }, s2Token);

    console.log('Waiting for plagiarism detection (v2)...');
    await new Promise(r => setTimeout(r, 10000));

    let statusV2 = await api(`/submissions/${sub2.id}`, 'GET', null, teacherToken);
    console.log('Similarity V2:', statusV2.data.highestSimilarity);

    if (statusV2.data.highestSimilarity < statusV1.data.highestSimilarity) {
        console.log('SUCCESS: Similarity decreased correctly!');
    } else {
        console.error('FAILURE: Similarity did not decrease!');
    }

    console.log('Checking plagiarism evidence list for Student 2...');
    const evidence = await api(`/submissions/${sub2.id}/plagiarism`, 'GET', null, teacherToken);
    console.log('Active plagiarism matches:', evidence.data.length);
    if (evidence.data.some(p => p.similarity > 0.8)) {
        console.error('FAILURE: Old high-similarity match still showing in evidence!');
    } else {
        console.log('SUCCESS: Old high-similarity match filtered out!');
    }
}

runTest().catch(console.error);
