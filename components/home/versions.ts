export type HomepageVersion = 1 | 2;

export interface HomepageConfig {
  active_version: HomepageVersion;
  revision: number;
  updated_at: string;
  updated_by: number | null;
}

export const HOME_VERSIONS = [
  {
    version: 1,
    name: "经典门户",
    subtitle: "CLASSIC",
    description:
      "保留原有布局、主题切换与全部模块入口。熟悉、轻盈，随时可以切回。",
  },
  {
    version: 2,
    name: "轨道控制台",
    subtitle: "ORBIT",
    description:
      "粒子星球、交互轨道与沉浸式深色界面。搜索、筛选，让每一次出发更直接。",
  },
] as const;

export function isHomepageVersion(value: unknown): value is HomepageVersion {
  return value === 1 || value === 2;
}
