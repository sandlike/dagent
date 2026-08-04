// Prometheus metrics 暴露
// 简易计数器（不依赖 prom-client，纯字符串格式）

interface Counter {
  name: string
  help: string
  value: number
  labels: Record<string, string>
}

const counters: Map<string, Counter> = new Map()

function key(name: string, labels: Record<string, string>): string {
  return name + JSON.stringify(labels)
}

export function inc(name: string, labels: Record<string, string> = {}, help = ''): void {
  const k = key(name, labels)
  if (!counters.has(k)) {
    counters.set(k, { name, help, value: 0, labels })
  }
  counters.get(k)!.value++
}

// 延迟直方图（简化版：记录 count + sum）
const timings: Map<string, { count: number; sum: number; labels: Record<string, string> }> = new Map()

export function observe(name: string, ms: number, labels: Record<string, string> = {}): void {
  const k = key(name, labels)
  if (!timings.has(k)) {
    timings.set(k, { count: 0, sum: 0, labels })
  }
  const t = timings.get(k)!
  t.count++
  t.sum += ms
}

// 生成 Prometheus 格式的 metrics 文本
export function renderMetrics(): string {
  const lines: string[] = []

  // Counters
  const counterNames = new Set<string>()
  for (const c of counters.values()) {
    counterNames.add(c.name)
  }
  for (const name of counterNames) {
    const sample = [...counters.values()].find((c) => c.name === name)!
    if (sample.help) lines.push(`# HELP ${name} ${sample.help}`)
    lines.push(`# TYPE ${name} counter`)
  }
  for (const c of counters.values()) {
    const labelStr = Object.entries(c.labels).map(([k, v]) => `${k}="${v}"`).join(',')
    lines.push(labelStr ? `${c.name}{${labelStr}} ${c.value}` : `${c.name} ${c.value}`)
  }

  // Timings (简化为 gauge：avg latency + counter：request count)
  const timingNames = new Set<string>()
  for (const t of timings.values()) {
    const baseName = t.labels['_metric'] || 'duration'
    timingNames.add(baseName)
  }
  for (const name of timingNames) {
    lines.push(`# TYPE ${name} gauge`)
  }
  for (const t of timings.values()) {
    const baseName = t.labels['_metric'] || 'duration'
    // 去掉 _metric 和内置标签
    const cleanLabels = Object.entries(t.labels)
      .filter(([k]) => k !== '_metric')
      .map(([k, v]) => `${k}="${v}"`).join(',')
    const avg = t.count > 0 ? (t.sum / t.count).toFixed(2) : '0'
    const labelStr = cleanLabels ? `${cleanLabels}` : ''
    // 用 gauge 输出平均延迟
    lines.push(`${baseName}_avg_ms{${labelStr}} ${avg}`)
    lines.push(`${baseName}_count{${labelStr}} ${t.count}`)
    lines.push(`${baseName}_total_ms{${labelStr}} ${t.sum}`)
  }

  return lines.join('\n') + '\n'
}
