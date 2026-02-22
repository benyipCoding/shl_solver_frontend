// 封装请求逻辑
import axios from "axios";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

apiClient.interceptors.request.use(async (config) => {
  if (typeof window === "undefined") {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    if (cookieHeader) {
      config.headers.Cookie = cookieHeader;
    }
  }
  return config;
});

// 响应拦截器，统一处理错误
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response) {
      // 如果是 401 且未重试过，尝试刷新 Token
      if (
        error.response.status === 401 &&
        !originalRequest._retry &&
        originalRequest.url !== "/auth/refresh"
      ) {
        originalRequest._retry = true;

        try {
          // 刷新接口调用
          // 创建一个新的 axios 实例来发送刷新请求，避免响应拦截死循环（虽然有 url 判断，但保险起见）
          // 同时，我们需要手动带上 cookie，因为新实例没有配置请求拦截器
          // 所以还是复用 apiClient 比较好，只要上面的 url 判断通过即可
          const refreshResponse = await apiClient.post("/auth/refresh");

          if (
            refreshResponse.status === 200 ||
            refreshResponse.status === 204
          ) {
            const setCookies = refreshResponse.headers["set-cookie"];

            if (typeof window === "undefined" && setCookies) {
              try {
                // 尝试在 Next.js 服务端上下文中更新 Cookie
                // 这使得浏览器端也能收到新的 Token
                const { cookies } = await import("next/headers");
                const cookieStore = await cookies();

                const cookiesArray = Array.isArray(setCookies)
                  ? setCookies
                  : [setCookies];

                for (const cookieStr of cookiesArray) {
                  // 简单的解析 Set-Cookie 字符串
                  // 格式通常是: name=value; Path=/; HttpOnly...
                  const firstPart = cookieStr.split(";")[0];
                  const [name, value] = firstPart.split("=");
                  if (name && value) {
                    // 注意：这里没有解析 maxAge, path, domain 等属性
                    // 我们可以简单地设置值，或者使用 cookie 解析库
                    // 但为了避免引入额外依赖，这里仅设置 name 和 value
                    // 在 Route Handler 中有效
                    cookieStore.set(name.trim(), value.trim());
                  }
                }

                // 更新重试请求的 Header
                // 由于 cookieStore.set 只是在 Next.js 的响应中排队
                // 我们还需要手动更新 axios 请求的 header
                const updatedCookieHeader = cookieStore
                  .getAll()
                  .map((c) => `${c.name}=${c.value}`)
                  .join("; ");

                originalRequest.headers.Cookie = updatedCookieHeader;
              } catch (cookieError) {
                console.warn(
                  "Failed to update cookies in Next.js context:",
                  cookieError
                );
                // 如果更新 Next.js cookie 失败（例如在 Server Component 中），
                // 至少更新 axios 请求头以保证本次重试成功
                // 手动解析 setCookies 并合并到请求头中
                const cookiesArray = Array.isArray(setCookies)
                  ? setCookies
                  : [setCookies];
                const newCookieMap = new Map();

                // 解析现有的 Cookie
                const currentCookies = (
                  originalRequest.headers.Cookie || ""
                ).split("; ");
                currentCookies.forEach((c: string) => {
                  const [key, val] = c.split("=");
                  if (key) newCookieMap.set(key, val);
                });

                // 合并新的 Cookie
                cookiesArray.forEach((cookieStr: string) => {
                  const [keyVal] = cookieStr.split(";");
                  const [key, val] = keyVal.split("=");
                  if (key && val) newCookieMap.set(key.trim(), val.trim());
                });

                originalRequest.headers.Cookie = Array.from(
                  newCookieMap.entries()
                )
                  .map(([k, v]) => `${k}=${v}`)
                  .join("; ");
              }
            }
          }

          // 重试原始请求
          return apiClient(originalRequest);
        } catch (refreshError: any) {
          // 刷新失败（例如返回 411 或其他错误）
          // 不需要特殊处理，直接返回原始错误或刷新错误
          console.error("Token refresh failed:", refreshError);

          // 刷新失败，清除所有 Cookie
          if (typeof window === "undefined") {
            try {
              const { cookies } = await import("next/headers");
              const cookieStore = await cookies();
              cookieStore.getAll().forEach((cookie) => {
                if (
                  cookie.name === "access_token" ||
                  cookie.name === "refresh_token"
                ) {
                  cookieStore.delete(cookie.name);
                }
              });
            } catch (error) {
              console.error("Failed to clear cookies:", error);
            }
          }

          // 如果是 411，或者刷新也 401，通常意味着登录彻底过期
          return Promise.reject(refreshError);
        }
      }

      console.error("API Error:", error.response.status, error.response.data);
      return Promise.reject({
        ...error.response.data,
        status: error.response.status, // 确保状态码透传
      });
    } else if (error.request) {
      console.error("No response received:", error.request);
      return Promise.reject({ error: "No response from server" });
    } else {
      console.error("Request setup error:", error.message);
      return Promise.reject({ error: "Request setup failed" });
    }
  }
);

export default apiClient;
