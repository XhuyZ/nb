# Plagiarism Detection Flow Demo Data

This document provides a realistic data set for testing the end-to-end plagiarism detection flow.

## 1. Actor Roles
- **Teacher**: `teacher1`
- **Students**: `student1`, `student2`, `student3`
- **Password**: `123456` (for all)

## 2. Course Setup
- **Course Name**: "Algorithmic Foundations & Plagiarism Test"
- **Teacher**: teacher1

### Chapter 1: Array Manipulation
- **Assignment 1**: "Array Median Finder"
- **Description**: Implement a function `findMedian(arr)` that returns the median of a sorted array.
- **Test Cases**:
  1. `input: [1, 2, 3]`, `expected: 2`
  2. `input: [1, 2, 3, 4]`, `expected: 2.5`

### Chapter 2: String Processing
- **Assignment 2**: "Palindrome Checker"
- **Description**: Implement a function `isPalindrome(str)` that checks if a string is the same backwards.
- **Test Cases**:
  1. `input: "racecar"`, `expected: true`
  2. `input: "hello"`, `expected: false`

### Chapter 3: Numerical Methods
- **Assignment 3**: "Prime Factorization"
- **Description**: Implement a function `getFactors(n)` that returns prime factors of a number.
- **Test Cases**:
  1. `input: 12`, `expected: [2, 2, 3]`

## 3. Submission Scenario (Assignment 1)

### Student 1 (Original Implementation) - Score 100%
```javascript
function findMedian(arr) {
  const mid = Math.floor(arr.length / 2);
  if (arr.length % 2 === 0) {
    return (arr[mid - 1] + arr[mid]) / 2;
  } else {
    return arr[mid];
  }
}
```

### Student 2 (Plagiarized - Renamed variables)
```javascript
function findMedian(items) {
  const middleIndex = Math.floor(items.length / 2);
  // Copying logic from student 1 but changing names
  if (items.length % 2 === 0) {
    return (items[middleIndex - 1] + items[middleIndex]) / 2;
  } else {
    return items[middleIndex];
  }
}
```

### Student 3 (Exact Copy)
```javascript
function findMedian(arr) {
  const mid = Math.floor(arr.length / 2);
  if (arr.length % 2 === 0) {
    return (arr[mid - 1] + arr[mid]) / 2;
  } else {
    return arr[mid];
  }
}
```

## 4. Expected System Behavior
1. **Student 1**: No plagiarism detected initially.
2. **Student 2**: High risk detected (Similarity ~0.9+).
   - **Segments**: "Matching logic pattern" identified for the `if/else` block.
3. **Student 3**: Critical risk detected (Similarity 1.0).
   - **Segments**: "Identical code block" identified for the entire function.

The **Evidence Chain API** (`/evidence-chain/:subId`) will provide the side-by-side code snapshots and highlighting segments for these matches.
