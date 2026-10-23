/**
 * Merge a core dictionary with per-namespace modules.
 * Top-level namespaces are merged shallowly; `values.*` sub-namespaces
 * (DB enum maps) are merged one level deeper so each module can contribute
 * its own value maps without clobbering others.
 */
export const mergeDictionaries = (core, modules) => {
  const result = { ...core, values: { ...(core.values || {}) } }

  for (const mod of modules) {
    if (!mod || typeof mod !== 'object') continue

    for (const [namespace, content] of Object.entries(mod)) {
      if (namespace === 'values' && content && typeof content === 'object') {
        for (const [valueNs, valueMap] of Object.entries(content)) {
          result.values[valueNs] = { ...(result.values[valueNs] || {}), ...valueMap }
        }
        continue
      }

      if (
        result[namespace] &&
        typeof result[namespace] === 'object' &&
        !Array.isArray(result[namespace]) &&
        content &&
        typeof content === 'object' &&
        !Array.isArray(content)
      ) {
        result[namespace] = { ...result[namespace], ...content }
      } else {
        result[namespace] = content
      }
    }
  }

  return result
}
