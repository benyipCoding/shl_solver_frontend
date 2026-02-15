// 封装请求逻辑
import axios from "axios";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

// export const postRequest = async <T>(
//   url: string,
//   data: AnalyzePayload,
//   config?: AxiosRequestConfig
// ): Promise<T> => {
//   const response = await apiClient.post<T>(url, data, config);
//   return response.data;
// };

// export const getRequest = async <T>(
//   url: string,
//   config?: AxiosRequestConfig
// ): Promise<T> => {
//   const response = await apiClient.get<T>(url, config);
//   return response.data;
// };

export default apiClient;
