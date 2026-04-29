// 封装请求逻辑
import axios from "axios";

const apiBaseUrl =
  process.env.API_BASE_URL?.trim() || process.env.NEXT_PUBLIC_BASE_URL?.trim();

const missingApiBaseUrlMessage =
  "缺少后端基地址配置，请设置 API_BASE_URL 或 NEXT_PUBLIC_BASE_URL";

const apiClient = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

apiClient.interceptors.request.use(async (config) => {
  if (!apiBaseUrl) {
    throw new Error(missingApiBaseUrlMessage);
  }

  if (typeof window === "undefined") {
    const { cookies, headers } = await import("next/headers");
    const cookieStore = await cookies();
    const headersStore = await headers(); // 获取请求头存储
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    if (cookieHeader) {
      config.headers.Cookie = cookieHeader;
    }

    // 2. 处理真实 IP 透传 (新增逻辑)
    // 获取原始请求中的 X-Forwarded-For，如果没有则说明 Next.js 是第一跳，获取直接连接 IP
    const distinctId = headersStore.get("x-forwarded-for");

    if (distinctId) {
      // 如果已经有转发链，直接透传
      config.headers["X-Forwarded-For"] = distinctId;
    } else {
      // 这里的逻辑稍微复杂：
      // 在 Next.js App Router 中，headers() 获取的是传入的 request header。
      // 在大多数部署环境（Vercel, Docker behind Nginx），请求到达 Next.js 时已经有了 X-Forwarded-For。
      // 如果你在本地开发，headersStore.get("x-forwarded-for") 可能是空的。
      // 为了安全起见，我们主要透传已有的值。
      // 注意：Next.js Middleware 或 Server Actions 中通常通过 header 透传 IP。
    }

    // 补充：透传 User-Agent (可选，通常对统计分析有用)
    const userAgent = headersStore.get("user-agent");
    if (userAgent) {
      config.headers["User-Agent"] = userAgent;
    }
  }
  return config;
});

// 辅助函数：解析 Set-Cookie 字符串
const parseCookieAttributes = (cookieStr: string) => {
  const parts = cookieStr.split(";");
  const firstPart = parts[0].trim();
  const separatorIndex = firstPart.indexOf("=");
  const name = firstPart.slice(0, separatorIndex).trim();
  const value = firstPart.slice(separatorIndex + 1).trim();

  const attributes: any = {
    name,
    value,
  };

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim();
    const separatorIndex = part.indexOf("=");
    const key =
      separatorIndex > -1
        ? part.slice(0, separatorIndex).toLowerCase()
        : part.toLowerCase();
    const val = separatorIndex > -1 ? part.slice(separatorIndex + 1) : true;

    switch (key) {
      case "domain":
        attributes.domain = val;
        break;
      case "path":
        attributes.path = val;
        break;
      case "max-age":
        attributes.maxAge = parseInt(val as string, 10);
        break;
      case "expires":
        attributes.expires = new Date(val as string).getTime();
        break;
      case "secure":
        attributes.secure = true;
        break;
      case "httponly":
        attributes.httpOnly = true;
        break;
      case "samesite":
        if (typeof val === "string") {
          const lowerVal = val.toLowerCase();
          if (["lax", "strict", "none"].includes(lowerVal)) {
            attributes.sameSite = lowerVal;
          }
        }
        break;
      default:
        break;
    }
  }

  // 移除无效属性
  if (attributes.maxAge && isNaN(attributes.maxAge)) {
    delete attributes.maxAge;
  }
  if (attributes.expires && isNaN(attributes.expires)) {
    delete attributes.expires;
  }

  return attributes;
};

// 辅助函数：在 Next.js 服务端上下文中更新 Cookie
const updateNextJsCookies = async (setCookies: string[] | string) => {
  if (typeof window !== "undefined") return null;

  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const cookiesArray = Array.isArray(setCookies) ? setCookies : [setCookies];

    for (const cookieStr of cookiesArray) {
      const cookieOptions = parseCookieAttributes(cookieStr);
      if (cookieOptions.name && cookieOptions.value) {
        cookieStore.set(cookieOptions);
      }
    }
    return cookieStore;
  } catch (error) {
    console.warn("Failed to update cookies in Next.js context:", error);
    throw error;
  }
};

// 辅助函数：手动更新 Axios 请求头中的 Cookie
const updateAxiosRequestHeaders = (
  originalRequest: any,
  setCookies: string[] | string
) => {
  const cookiesArray = Array.isArray(setCookies) ? setCookies : [setCookies];
  const newCookieMap = new Map();

  // 解析现有的 Cookie
  const currentCookies = (originalRequest.headers.Cookie || "").split("; ");
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

  originalRequest.headers.Cookie = Array.from(newCookieMap.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
};

// 辅助函数：清除认证 Cookie
const clearAuthCookies = async () => {
  if (typeof window === "undefined") {
    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      cookieStore.getAll().forEach((cookie) => {
        if (cookie.name === "access_token" || cookie.name === "refresh_token") {
          cookieStore.delete(cookie.name);
        }
      });
    } catch (error) {
      console.error("Failed to clear cookies:", error);
    }
  }
};

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
          const refreshResponse = await apiClient.post("/auth/refresh");

          if (
            refreshResponse.status === 200 ||
            refreshResponse.status === 204
          ) {
            const setCookies = refreshResponse.headers["set-cookie"];

            if (typeof window === "undefined" && setCookies) {
              try {
                // 尝试在 Next.js 服务端上下文中更新 Cookie
                const cookieStore = await updateNextJsCookies(setCookies);

                // 更新重试请求的 Header
                if (cookieStore) {
                  const updatedCookieHeader = cookieStore
                    .getAll()
                    .map((c) => `${c.name}=${c.value}`)
                    .join("; ");
                  originalRequest.headers.Cookie = updatedCookieHeader;
                }
              } catch (updateError) {
                // 如果更新 Next.js cookie 失败，手动更新 axios 请求头以保证本次重试成功
                updateAxiosRequestHeaders(originalRequest, setCookies);
              }
            }
          }

          // 重试原始请求
          return apiClient(originalRequest);
        } catch (refreshError: any) {
          // 刷新失败，清除所有 Cookie
          console.error("Token refresh failed:", refreshError);
          await clearAuthCookies();

          return Promise.reject(refreshError);
        }
      }

      console.error("API Error:", error.response.status, error.response.data);
      return Promise.reject({
        ...error.response.data,
        status: error.response.status,
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
