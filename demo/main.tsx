import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BatchReviewView, useBatchReview } from '../src';
import type { ReviewStatus } from '../src';
import { Icon } from '../src/Icon';
import type { IconName } from '../src/Icon';
import { columns, integrationCode, labels, mixedProposals, pricingProposals, products, rules } from './data';
import './style.css';

function DocsDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [copyState, setCopyState] = useState('复制代码');
  useEffect(() => { ref.current?.showModal(); }, []);
  const copy = async () => {
    try { await navigator.clipboard.writeText(integrationCode); setCopyState('已复制'); }
    catch { setCopyState('请选中下方代码复制'); }
  };
  return <dialog className="app-docs" ref={ref} onClose={onClose} aria-labelledby="docs-title">
    <div className="docs-top"><span>DEVELOPER EXPERIENCE</span><button className="app-icon-button" aria-label="关闭接入说明" onClick={() => ref.current?.close()}><Icon name="x" /></button></div>
    <h2 id="docs-title">One component.<br /><em>Your approval flow.</em></h2>
    <p>传入原始数据和提议操作，审核逻辑交给组件，提交方式由你的应用决定。</p>
    <div className="docs-code-top"><span>React + TypeScript</span><button onClick={copy}><Icon name="copy" size={13} />{copyState}</button></div>
    <pre tabIndex={0}>{integrationCode}</pre>
    <p className="docs-note">安装：npm install @batype/react-batch-review。查看仓库 README 获取完整接入说明。<a href="https://github.com/batype/react-batch-review" target="_blank" rel="noreferrer">打开 GitHub 仓库 →</a></p>
  </dialog>;
}

function App() {
  const [scenario, setScenario] = useState<'pricing' | 'mixed'>('pricing');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [docs, setDocs] = useState(false);
  const review = useBatchReview({ base: products, proposals: scenario === 'pricing' ? pricingProposals : mixedProposals, columns, rules });
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const switchScenario = (value: typeof scenario) => { setScenario(value); review.setStatus('all'); review.setKind('all'); review.setQuery(''); };
  const nav: { status: ReviewStatus; icon: IconName; title: string; count: number }[] = [
    { status: 'all', icon: 'layers', title: '全部变更', count: review.counts.total },
    { status: 'pending', icon: 'clock', title: '待审核', count: review.counts.pending },
    { status: 'accepted', icon: 'check', title: '已接受', count: review.counts.accepted },
    { status: 'rejected', icon: 'x', title: '已拒绝', count: review.counts.rejected },
    { status: 'warning', icon: 'warning', title: '需要留意', count: review.counts.warning },
  ];
  return <div className="app-shell">
    <header className="app-header"><a className="app-brand" href="#" aria-label="Batch Review 首页"><span className="app-brand-mark"><Icon name="check" size={23} /></span><span>batch<span className="app-brand-slash">/</span>review<span className="app-version">v0.1</span></span></a><nav aria-label="主导航"><span className="app-nav-active">Playground</span><button onClick={() => setDocs(true)}>接入组件 <Icon name="arrow" size={14} /></button></nav><div className="app-header-right"><span className="app-license">MIT LICENSE</span><button className="app-icon-button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={theme === 'light' ? '切换深色模式' : '切换浅色模式'} title="切换主题"><Icon name={theme === 'light' ? 'moon' : 'sun'} size={17} /></button></div></header>
    <main>
      <section className="app-hero"><div><p className="app-eyebrow"><span /> A LITTLE CONTROL GOES A LONG WAY</p><h1>Big changes.<br /><em>Clear decisions.</em><span className="hero-asterisk">✳</span></h1><p className="app-hero-description">批量修改，先审再提交。<br className="mobile-break" />让每一次数据变更，都经过你的决定。</p></div><div className="app-hero-note"><span className="app-note-line" /><span>Built for the moment<br />before you hit “apply”.</span><div><span>01 PROPOSE</span><Icon name="arrow" size={11} /><b>02 REVIEW</b><Icon name="arrow" size={11} /><span>03 EXPORT</span></div></div></section>
      <div className="app-workspace">
        <aside className="app-sidebar"><div className="app-sidebar-section"><span className="app-section-label">PLAYGROUND / 演示场景</span><button className={`app-scenario ${scenario === 'pricing' ? 'is-active' : ''}`} aria-pressed={scenario === 'pricing'} onClick={() => switchScenario('pricing')}><span className="app-scenario-icon"><Icon name="sparkles" size={19} /></span><span><strong>AI 商品调价</strong><small>100 项价格更新</small></span><Icon name="chevron" size={13} /></button><button className={`app-scenario ${scenario === 'mixed' ? 'is-active' : ''}`} aria-pressed={scenario === 'mixed'} onClick={() => switchScenario('mixed')}><span className="app-scenario-icon"><Icon name="box" size={19} /></span><span><strong>商品目录更新</strong><small>新增、修改与删除</small></span><Icon name="chevron" size={13} /></button></div>
          <div className="app-sidebar-section app-sidebar-filters"><span className="app-section-label">REVIEW / 审核视图</span>{nav.map(item => <button key={item.status} onClick={() => review.setStatus(item.status)} aria-pressed={review.status === item.status} className={`app-filter ${review.status === item.status ? 'is-active' : ''} ${item.status === 'warning' ? 'app-filter-warning' : ''}`}><Icon name={item.icon} size={16} /><span>{item.title}</span><small>{item.count}</small></button>)}</div>
          <div className="app-safety-note"><span className="app-safety-icon"><Icon name="shield" size={23} /></span><h3>你的决定，才算数。</h3><p>所有示例在浏览器本地运行。<br />只有明确批准的操作，<br />才会进入导出清单。</p><span><i /> 数据不会被上传</span></div>
          <button className="app-sidebar-docs" onClick={() => setDocs(true)}><Icon name="code" size={15} />看看如何接入<Icon name="arrow" size={14} /></button>
        </aside>
        <section className="app-main-review" aria-label="变更审核工作台"><div className="app-mobile-scenarios" role="group" aria-label="演示场景"><button aria-pressed={scenario === 'pricing'} onClick={() => switchScenario('pricing')}><Icon name="sparkles" size={15} />AI 商品调价</button><button aria-pressed={scenario === 'mixed'} onClick={() => switchScenario('mixed')}><Icon name="box" size={15} />商品目录更新</button></div><div className="app-review-heading"><div><div className="app-review-breadcrumb">PLAYGROUND <span>/</span> {scenario === 'pricing' ? 'AI PRICING' : 'CATALOG UPDATE'}</div><h2>{scenario === 'pricing' ? '商品调价审核' : '商品目录更新'}</h2><p>{scenario === 'pricing' ? 'AI 已生成调价建议。检查变化，留下你认可的部分。' : '一次审核新增、库存变化与删除，确认每一步影响。'}</p></div><span className="app-data-badge"><i /> 预置演示数据</span></div>
          <div className="app-stats">{[
            { title: '待审核', icon: 'clock' as const, value: review.counts.pending, suffix: '项变更', style: '' },
            { title: '已接受', icon: 'check' as const, value: review.counts.accepted, suffix: '将进入导出', style: 'accepted' },
            { title: '已拒绝', icon: 'x' as const, value: review.counts.rejected, suffix: '不会被应用', style: 'rejected' },
            { title: '需要留意', icon: 'warning' as const, value: review.counts.warning, suffix: scenario === 'pricing' ? '调价幅度 > 20%' : '存在异常或删除', style: 'flagged' },
          ].map(stat => <button key={stat.title} className={`app-stat ${stat.style}`} onClick={() => review.setStatus(stat.style === 'flagged' ? 'warning' : stat.style === 'accepted' ? 'accepted' : stat.style === 'rejected' ? 'rejected' : 'pending')} aria-label={`查看${stat.title}的 ${stat.value} 项变更`}><span>{stat.title}<Icon name={stat.icon} size={16} /></span><div><strong>{String(stat.value).padStart(2, '0')}</strong><small>{stat.suffix}</small></div></button>)}</div>
          <div className="app-tip"><span className="app-tip-marker">TRY THIS</span><p>{scenario === 'pricing' ? <>先点「需要留意」找出 3 项异常，再决定是否接受。</> : <>试试按操作类型筛选，逐项审核新增与删除。</>}</p><button onClick={() => { review.setQuery(''); review.setKind('all'); review.setStatus('warning'); }}>查看提醒 <Icon name="arrow" size={14} /></button></div>
          <BatchReviewView controller={review} columns={columns} labels={labels} getRowLabel={row => row.name} getRowCaption={row => `${row.id} / ${row.category}`} renderRowIcon={row => <Icon name={row.category === '音频设备' ? 'moon' : row.category === '生活方式' ? 'leaf' : row.category === '数码配件' ? 'layers' : 'box'} size={22} />} />
          <p className="app-under-review"><Icon name="info" size={13} />切换演示场景会重新开始审核。导出清单不会执行数据修改。</p>
        </section>
      </div>
    </main>
    <footer className="app-bottom"><span>Small component. <em>Thoughtful changes.</em></span><div><span>REACT + TYPESCRIPT</span><i /><span>OPEN SOURCE · MIT</span></div></footer>
    {docs && <DocsDialog onClose={() => setDocs(false)} />}
  </div>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
