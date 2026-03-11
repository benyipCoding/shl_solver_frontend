// import { SHLSolverHistoryItem } from "@/interfaces/history";
// import { AnalysisResult } from "@/interfaces/shl_solver";

// const dummyResult: AnalysisResult = {
//   summary: "This code implements a binary search algorithm.",
//   key_concepts: ["Binary Search", "Algorithm", "Time Complexity"],
//   constraints: ["Array must be sorted", "Values must be integers"],
//   solutions: {
//     Python:
//       "def binary_search(arr, x):\n    low = 0\n    high = len(arr) - 1\n    mid = 0\n\n    while low <= high:\n        mid = (low + high) // 2\n        if arr[mid] < x:\n            low = mid + 1\n        elif arr[mid] > x:\n            high = mid - 1\n        else:\n            return mid\n    return -1",
//     Java: "class BinarySearch {\n    int binarySearch(int arr[], int x) {\n        int l = 0, r = arr.length - 1;\n        while (l <= r) {\n            int m = l + (r - l) / 2;\n            if (arr[m] == x)\n                return m;\n            if (arr[m] < x)\n                l = m + 1;\n            else\n                r = m - 1;\n        }\n        return -1;\n    }\n}",
//   },
//   complexity: {
//     time: "O(log n)",
//     space: "O(1)",
//   },
// };

// export const MOCK_HISTORY: SHLSolverHistoryItem[] = [
//   {
//     id: 1,
//     image_urls: "/uploads/image1.png,/uploads/image2.png",
//     token_count: 1500,
//     model: "GPT-4o",
//     user_id: "user_test_01",
//     result_json: dummyResult,
//     total_test_cases: 10,
//     passed_test_cases: 10,
//     status: "completed",
//     created_at: "2024-03-10T14:30:00Z",
//   },
//   {
//     id: 2,
//     image_urls: "/uploads/image3.png",
//     token_count: 800,
//     model: "Claude 3.5 Sonnet",
//     user_id: "dev_user",
//     result_json: {
//       ...dummyResult,
//       summary: "Analysis of a sorting algorithm.",
//     },
//     total_test_cases: 5,
//     passed_test_cases: 4,
//     status: "completed",
//     created_at: "2024-03-09T09:15:00Z",
//   },
//   {
//     id: 3,
//     image_urls: "/uploads/fail_case.png",
//     token_count: 200,
//     model: "Gemini Pro",
//     user_id: "guest",
//     result_json: null as any, // Simulate no result for failed/pending
//     total_test_cases: 0,
//     passed_test_cases: 0,
//     status: "failed",
//     error_message: "Image too blurry.",
//     created_at: "2024-03-08T18:45:00Z",
//   },
// ];
