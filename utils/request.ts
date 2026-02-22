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
