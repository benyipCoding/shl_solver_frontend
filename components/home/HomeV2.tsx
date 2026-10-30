"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Command,
  Crosshair,
  Orbit,
  Pause,
  Play,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import UserHeaderActions from "@/components/common/UserHeaderActions";
import OrbitCanvas from "./OrbitCanvas";
import { HOME_MODULES } from "./modules";
import styles from "./orbit.module.css";

const categories = ["全部工具", "智能辅助", "数据分析", "游戏娱乐"];

function ModuleArtwork({ id }: { id: string }) {
  if (id === "market") {
    return (
      <svg viewBox="0 0 360 150" fill="none" aria-hidden="true">
        {[30, 65, 100, 135].map((y) => (
          <path
            key={y}
            d={`M0 ${y}H360`}
            stroke="currentColor"
            opacity=".12"
            strokeDasharray="3 6"
          />
        ))}
        {Array.from({ length: 27 }, (_, i) => {
          const y = 98 - i * 2.2 + Math.sin(i * 1.1) * 15;
          return (
            <g key={i} opacity={i % 3 === 0 ? ".35" : ".8"}>
              <path d={`M${i * 13 + 8} ${y - 13}v39`} stroke="currentColor" />
              <rect
                x={i * 13 + 5}
                y={y}
                width="6"
                height={i % 3 === 0 ? 16 : 11}
                fill="currentColor"
                rx="1"
              />
            </g>
          );
        })}
        <path
          d="M0 123C40 125 50 87 87 96S137 112 161 83 190 94 220 67 255 80 287 45 320 58 360 20"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    );
  }
  if (id === "shl")
    return (
      <div className={styles.logicArt} aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} data-filled={i === 2 || i === 4 || i === 6}>
            {i === 8 ? "?" : ""}
          </span>
        ))}
      </div>
    );
  if (id === "excel")
    return (
      <div className={styles.sheetArt} aria-hidden="true">
        {Array.from({ length: 20 }, (_, i) => (
          <span key={i} data-filled={[6, 7, 11, 12].includes(i)} />
        ))}
      </div>
    );
  if (id === "doctor")
    return (
      <svg viewBox="0 0 230 120" fill="none" aria-hidden="true">
        <path
          d="M0 65H52L65 49 80 80 100 18 122 101 139 55 154 65H230"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle cx="100" cy="18" r="5" fill="currentColor" opacity=".5" />
      </svg>
    );
  return (
    <div className={styles.battleArt} aria-hidden="true">
      <span />
      <span />
      <span />
      <Crosshair size={76} strokeWidth={0.8} />
    </div>
  );
}

export default function HomeV2() {
  const [activeNode, setActiveNode] = useState(0);
  const [category, setCategory] = useState("全部工具");
  const [query, setQuery] = useState("");
  const [paused, setPaused] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const active = HOME_MODULES[activeNode];
  const filtered = HOME_MODULES.filter(
    (module) => category === "全部工具" || module.category === category,
  );
  const searchResults = HOME_MODULES.filter((module) =>
    `${module.name} ${module.english} ${module.description} ${module.tags.join(" ")}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  const openSearch = () => {
    setQuery("");
    dialogRef.current?.showModal();
    searchRef.current?.focus();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (dialogRef.current?.open) dialogRef.current.close();
        else {
          dialogRef.current?.showModal();
          searchRef.current?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className={styles.portal} data-paused={paused}>
      <a className={styles.skipLink} href="#tools">
        跳转到模块入口
      </a>
      <div className={styles.starfield} aria-hidden="true" />
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand} aria-label="AI Hub 首页">
            <span className={styles.brandMark}>
              <Orbit size={23} strokeWidth={1.5} />
            </span>
            <span>
              AI HUB<span className={styles.brandDot}>.</span>
            </span>
          </Link>
          <nav className={styles.navigation} aria-label="主导航">
            <a href="#tools" className={styles.navActive}>
              探索工具
            </a>
            <a href="#philosophy">
              关于空间 <ArrowUpRight size={12} />
            </a>
          </nav>
          <div className={styles.headerActions}>
            <button
              type="button"
              onClick={openSearch}
              className={styles.searchTrigger}
              aria-label="搜索工具（Ctrl 或 Command 加 K）"
            >
              <Search size={15} />
              <span>寻找你的工具</span>
              <kbd>⌘ K</kbd>
            </button>
            <UserHeaderActions creditLogClassName={styles.creditLogDialog} />
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}>
              <span className={styles.statusDot} /> A SPACE FOR YOUR NEXT IDEA{" "}
              <span className={styles.eyebrowLine} />
            </div>
            <h1 id="hero-title">
              无限可能，
              <br />
              <span>即刻接入。</span>
              <i aria-hidden="true">✳</i>
            </h1>
            <p className={styles.heroDescription}>
              让好奇心，抵达更远的地方。
              <br />
              从一个灵感到一次突破，你的智能工具宇宙，由此展开。
            </p>
            <div className={styles.heroActions}>
              <a href="#tools" className={styles.primaryButton}>
                探索工作空间 <ArrowUpRight size={19} />
              </a>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={openSearch}
              >
                <Command size={16} /> 快速启动
              </button>
            </div>
            <div className={styles.heroFootnote}>
              <div className={styles.miniIcons}>
                {HOME_MODULES.slice(0, 3).map((m) => (
                  <span key={m.id} style={{ color: m.color }}>
                    <m.icon size={15} />
                  </span>
                ))}
              </div>
              <span>
                <b>05</b> 个独立模块 <i /> 一个无限延伸的空间
              </span>
            </div>
          </div>

          <div className={styles.orbitStage}>
            <div className={styles.stageCorner}>
              <Crosshair size={13} /> INTELLIGENCE CORE{" "}
              <span>{active.number} / 05</span>
            </div>
            <div className={styles.orbitCanvas}>
              <OrbitCanvas paused={paused} />
            </div>
            <div className={styles.coreLabel} aria-hidden="true">
              <span>AI</span>
              <small>CONNECTED IDEAS</small>
            </div>
            <div className={styles.orbitRing} aria-hidden="true" />
            {HOME_MODULES.map((module, index) => (
              <Link
                key={module.id}
                href={module.href}
                prefetch={false}
                className={`${styles.orbitNode} ${styles[`node${index}`]}`}
                data-active={index === activeNode}
                style={{ "--node-color": module.color } as CSSProperties}
                onMouseEnter={() => setActiveNode(index)}
                onFocus={() => setActiveNode(index)}
                aria-label={`进入${module.name}`}
              >
                <span className={styles.nodeIcon}>
                  <module.icon size={21} strokeWidth={1.4} />
                </span>
                <span className={styles.nodeLabel}>
                  {module.name}
                  <ArrowUpRight size={11} />
                </span>
              </Link>
            ))}
            <div className={styles.orbitCaption}>
              <span className={styles.statusDot} />
              <span>{active.english}</span>
              <span className={styles.captionIndex}>{active.number} / 05</span>
            </div>
            <div className={styles.orbitHint}>
              触碰一个节点，开启新的可能 <ArrowUpRight size={12} />
            </div>
          </div>
        </section>

        <div className={styles.signalStrip}>
          <span>
            <AudioLines size={17} /> BUILT FOR THE CURIOUS.
          </span>
          <div>
            <span>思考</span>
            <i /> <span>创造</span>
            <i /> <span>探索</span>
            <i /> <span>突破</span>
          </div>
          <a href="#tools">
            向下探索 <ArrowDown size={13} />
          </a>
        </div>

        <section
          id="tools"
          className={styles.toolsSection}
          aria-labelledby="tools-title"
        >
          <div className={styles.sectionTop}>
            <div>
              <p className={styles.sectionKicker}>
                THE WORKSPACE <span>/ 01</span>
              </p>
              <h2 id="tools-title">
                选择你的下一站<span>。</span>
              </h2>
              <p className={styles.sectionDescription}>
                不同的目的地，同样值得探索。找到你此刻需要的超能力。
              </p>
            </div>
            <span className={styles.moduleCount}>
              <b>05</b> MODULES TO EXPLORE
            </span>
          </div>
          <div className={styles.toolsToolbar}>
            <div className={styles.filters} aria-label="工具分类">
              {categories.map((item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => setCategory(item)}
                  aria-pressed={category === item}
                  className={category === item ? styles.filterActive : ""}
                >
                  {item}
                  {item === "全部工具" && <span>5</span>}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={openSearch}
              className={styles.toolsSearch}
              aria-label="搜索模块"
            >
              <Search size={16} />
              <span>搜索模块</span>
            </button>
          </div>
          <div className={styles.moduleGrid} aria-live="polite">
            {filtered.map((module) => (
              <Link
                href={module.href}
                prefetch={false}
                key={module.id}
                className={`${styles.moduleCard} ${module.id === "market" ? styles.featuredCard : ""}`}
                style={{ "--card-color": module.color } as CSSProperties}
              >
                <div className={styles.cardTop}>
                  <span className={styles.cardIcon}>
                    <module.icon size={22} strokeWidth={1.5} />
                  </span>
                  <span className={styles.cardCategory}>{module.category}</span>
                  <ArrowUpRight
                    className={styles.cardArrow}
                    size={20}
                    strokeWidth={1.3}
                  />
                </div>
                <div className={styles.cardArt}>
                  <ModuleArtwork id={module.id} />
                </div>
                <div className={styles.cardContent}>
                  <p className={styles.cardEnglish}>{module.english}</p>
                  <h3>{module.name}</h3>
                  <p className={styles.cardDescription}>{module.description}</p>
                </div>
                <div className={styles.cardBottom}>
                  <div>
                    {module.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  <span className={styles.cardLaunch}>
                    进入模块 <ArrowRight size={14} />
                  </span>
                  <span className={styles.cardNumber}>{module.number}</span>
                </div>
              </Link>
            ))}
          </div>
          <div className={styles.workspaceNote}>
            <span>
              <Sparkles size={14} /> 好工具，让想法自由生长。
            </span>
            <span>
              更多可能，正在路上 <span className={styles.noteDots}>···</span>
            </span>
          </div>
        </section>

        <section id="philosophy" className={styles.philosophy}>
          <span className={styles.philosophyIcon}>
            <Orbit size={38} strokeWidth={1} />
          </span>
          <div>
            <p className={styles.sectionKicker}>
              LESS FRICTION. MORE POSSIBILITY.
            </p>
            <h2>把复杂留给工具，把可能留给你。</h2>
            <p>
              一个入口，连接思考、数据、健康、游戏与交易。随时出发，自由探索。
            </p>
          </div>
          <a href="#tools" aria-label="返回工具列表">
            <ArrowUpRight size={27} strokeWidth={1} />
          </a>
        </section>

        <footer className={styles.footer}>
          <Link href="/" className={styles.footerBrand}>
            <Orbit size={18} /> AI HUB<span>一个不断生长的智能空间</span>
          </Link>
          <div>
            <button
              type="button"
              aria-pressed={paused}
              onClick={() => setPaused((value) => !value)}
            >
              {paused ? <Play size={12} /> : <Pause size={12} />}
              {paused ? "开启动效" : "暂停动效"}
            </button>
            <span>DESIGNED FOR POSSIBILITY ↗</span>
          </div>
        </footer>
      </main>

      <dialog
        ref={dialogRef}
        className={styles.commandDialog}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          const links = Array.from(
            dialogRef.current?.querySelectorAll<HTMLAnchorElement>("a") ?? [],
          );
          const current = links.indexOf(
            document.activeElement as HTMLAnchorElement,
          );
          const next =
            current < 0
              ? event.key === "ArrowDown"
                ? 0
                : links.length - 1
              : (current + (event.key === "ArrowDown" ? 1 : links.length - 1)) %
                links.length;
          links[next]?.focus();
        }}
        aria-labelledby="command-title"
      >
        <div className={styles.commandContent}>
          <div className={styles.commandHeader}>
            <Search size={20} />
            <label
              id="command-title"
              className={styles.srOnly}
              htmlFor="module-query"
            >
              搜索并打开工具
            </label>
            <input
              id="module-query"
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter")
                  dialogRef.current
                    ?.querySelector<HTMLAnchorElement>("a")
                    ?.click();
              }}
              placeholder="想做些什么？搜索工具、功能…"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="关闭搜索"
            >
              <X size={18} />
            </button>
          </div>
          <div className={styles.commandResults}>
            <p>{query ? `${searchResults.length} 个匹配工具` : "快速前往"}</p>
            {searchResults.map((module) => (
              <Link
                key={module.id}
                href={module.href}
                prefetch={false}
                onClick={() => dialogRef.current?.close()}
              >
                <span style={{ color: module.color }}>
                  <module.icon size={22} />
                </span>
                <div>
                  <b>{module.name}</b>
                  <small>{module.short}</small>
                </div>
                <ArrowUpRight size={16} />
              </Link>
            ))}
            {searchResults.length === 0 && (
              <div className={styles.noResults}>
                没有找到相关工具，试试「数据」「交易」或「逻辑」。
              </div>
            )}
          </div>
          <div className={styles.commandFooter}>
            <span>↑ ↓ 选择 · Enter 打开</span>
            <span>ESC 关闭</span>
          </div>
        </div>
      </dialog>
    </div>
  );
}
