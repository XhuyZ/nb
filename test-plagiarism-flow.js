
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
    console.log('--- STARTING PLAGIARISM FLOW TEST ---');

    console.log('Logging in actors...');
    const teacherToken = (await api('/auth/login', 'POST', { username: 'teacher1', password: '123456' })).data.access_token;
    const s1Token = (await api('/auth/login', 'POST', { username: 'student1', password: '123456' })).data.access_token;
    const s2Token = (await api('/auth/login', 'POST', { username: 'student2', password: '123456' })).data.access_token;
    const s3Token = (await api('/auth/login', 'POST', { username: 'student3', password: '123456' })).data.access_token;

    console.log('Creating "Plagiarism Demo Course"...');
    const course = (await api('/courses', 'POST', {
        name: 'Plagiarism Demo Course',
        description: 'Demonstrating side-by-side evidence chain'
    }, teacherToken)).data;
    const courseId = course.id;

    const chapters = [];
    const assignments = [];

    const assignmentsData = [
        {
            title: 'Array Median Finder',
            desc: 'Calculate the median of a sorted array.',
            testCases: [
                { input: '[1, 2, 3]', expectedOutput: '2', isSample: true, weight: 1, orderIndex: 1 },
                { input: '[1, 2, 3, 4]', expectedOutput: '2.5', isSample: false, weight: 2, orderIndex: 2 }
            ],
            code: 'function findMedian(arr) {\n  const mid = Math.floor(arr.length / 2);\n  if (arr.length % 2 === 0) {\n    return (arr[mid - 1] + arr[mid]) / 2;\n  } else {\n    return arr[mid];\n  }\n}'
        },
        {
            title: 'Palindrome Checker',
            desc: 'Check if a string is a palindrome.',
            testCases: [
                { input: 'racecar', expectedOutput: 'true', isSample: true, weight: 1, orderIndex: 1 }
            ],
            code: 'function isPalindrome(str) { return str === str.split("").reverse().join(""); }'
        },
        {
            title: 'Prime Factorizer',
            desc: 'Find prime factors.',
            testCases: [
                { input: '12', expectedOutput: '[2, 2, 3]', isSample: true, weight: 1, orderIndex: 1 }
            ],
            code: 'function getFactors(n) { /* Logic */ return [2, 2, 3]; }'
        }
    ];

    for (let i = 0; i < 3; i++) {
        console.log(`Creating Chapter and Assignment ${i + 1}: ${assignmentsData[i].title}`);
        const chapter = (await api(`/courses/${courseId}/chapters`, 'POST', {
            title: `Chapter ${i + 1}: ${assignmentsData[i].title}`,
            orderIndex: i + 1
        }, teacherToken)).data;

        const formData = new FormData();
        formData.append('title', assignmentsData[i].title);
        formData.append('chapterId', chapter.id);
        formData.append('description', assignmentsData[i].desc);
        formData.append('status', 'open');
        formData.append('testCases', JSON.stringify(assignmentsData[i].testCases));

        const assignment = (await api('/assignments', 'POST', formData, teacherToken)).data;
        assignments.push(assignment);
    }

    console.log('Enrolling students...');
    await api(`/courses/${courseId}/enroll`, 'POST', {}, s1Token);
    await api(`/courses/${courseId}/enroll`, 'POST', {}, s2Token);
    await api(`/courses/${courseId}/enroll`, 'POST', {}, s3Token);

    console.log('Student 1 (Original) submits Assignment 1...');
    await api('/submissions', 'POST', {
        assignmentId: assignments[0].id,
        code: assignmentsData[0].code,
        language: 'javascript'
    }, s1Token);

    console.log('Student 2 (Rename Plagiarism) submits Assignment 1...');
    const plagCodeS2 = `function findMedian(items) {
  const middleIndex = Math.floor(items.length / 2);
  // This logic is copied from student 1 but names changed
  if (items.length % 2 === 0) {
    return (items[middleIndex - 1] + items[middleIndex]) / 2;
  } else {
    return items[middleIndex];
  }
}`;
    const sub2 = (await api('/submissions', 'POST', {
        assignmentId: assignments[0].id,
        code: plagCodeS2,
        language: 'javascript'
    }, s2Token)).data;

    console.log('Student 3 (Exact Copy) submits Assignment 1...');
    await api('/submissions', 'POST', {
        assignmentId: assignments[0].id,
        code: assignmentsData[0].code,
        language: 'javascript'
    }, s3Token);

    console.log('Waiting for detection...');
    await new Promise(r => setTimeout(r, 7000));

    console.log('Fetching evidence chain for Student 2...');
    const evidence = await api(`/evidence-chain/${sub2.id}`, 'GET', null, teacherToken);

    console.log('--- TEST COMPLETED ---');
    console.log('Plagiarism matches found:', evidence.data.chain.length);
    if (evidence.data.chain.length > 0) {
        evidence.data.chain.forEach((match, idx) => {
            console.log(`Match ${idx}: with ${match.pair.studentB}, Similarity: ${match.similarity}`);
            console.log(`Segments:`, match.evidence.segments.map(s => s.title));
        });
    }
}

runTest().catch(console.error);
