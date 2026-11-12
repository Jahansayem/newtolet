import React from 'react'
import Dialog from '../../../ui/Dialog'

const LIST_SHORTCUTS = [
  { keys: ['J'], label: 'Next listing' },
  { keys: ['K'], label: 'Previous listing' },
  { keys: ['Enter'], label: 'Open the details of the highlighted listing' },
  { keys: ['A'], label: 'Approve the highlighted listing (Undo for 5 seconds)' },
  { keys: ['R'], label: 'Reject the highlighted listing' },
  { keys: ['E'], label: 'Edit the highlighted listing' },
]

const EDITOR_SHORTCUTS = [
  { keys: ['S'], also: ['Ctrl', 'S'], label: 'Save' },
  { keys: ['Shift', 'S'], also: ['Ctrl', 'Shift', 'S'], label: 'Save and open the next pending listing' },
]

const Keys = ({ keys }) => (
  <span className="inline-flex items-center gap-1">
    {keys.map((key, index) => (
      <React.Fragment key={key}>
        {index > 0 ? <span aria-hidden="true">+</span> : null}
        <kbd className="rounded-[var(--radius-chip)] border border-line bg-canvas px-2 py-0.5 font-mono text-caption text-ink">{key}</kbd>
      </React.Fragment>
    ))}
  </span>
)

const Group = ({ title, items }) => (
  <section>
    <h3 className="mb-2 text-sm font-semibold text-ink">{title}</h3>
    <dl className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-start justify-between gap-4 text-sm">
          <dt className="text-ink">{item.label}</dt>
          <dd className="flex shrink-0 flex-wrap items-center justify-end gap-2 text-muted">
            <Keys keys={item.keys} />
            {item.also ? (
              <>
                <span>or</span>
                <Keys keys={item.also} />
              </>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  </section>
)

/** The keyboard shortcuts of the Properties screens, opened with "?". */
export default function ShortcutHelp({ open, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts" description="Single keys work when you are not typing in a field and no dialog is open." size="md">
      <div className="space-y-5" data-testid="shortcut-help">
        <Group title="Listings table" items={LIST_SHORTCUTS} />
        <Group title="Listing editor" items={EDITOR_SHORTCUTS} />
        <Group title="Anywhere" items={[{ keys: ['?'], label: 'Show this list' }, { keys: ['Esc'], label: 'Close a dialog' }]} />
      </div>
    </Dialog>
  )
}
