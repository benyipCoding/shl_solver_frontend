export const BACKTEST_SHARE_PARAM = "share";

export const buildBacktestShareUrl = (origin: string, publicId: string) => {
  const url = new URL("/market-master", origin);
  url.searchParams.set(BACKTEST_SHARE_PARAM, publicId);
  return url.toString();
};

export const removeBacktestShareParam = (href: string) => {
  const url = new URL(href);
  url.searchParams.delete(BACKTEST_SHARE_PARAM);
  return `${url.pathname}${url.search}${url.hash}`;
};
