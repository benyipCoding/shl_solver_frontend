import HomeV1 from "@/components/home/HomeV1";
import HomeV2 from "@/components/home/HomeV2";
import { getPublishedHomepageVersion } from "@/components/home/homepage-server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const version = await getPublishedHomepageVersion();
  return version === 2 ? <HomeV2 /> : <HomeV1 />;
}
