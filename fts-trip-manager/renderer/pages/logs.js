import { LogViewer } from '../components/log-viewer.js'

export const LogsPage = {
  render(container, ctx) {
    const { api, toast, state } = ctx
    const viewer = LogViewer({
      logs: state.logs,
      onClear: async () => { await api.logsClear(); toast.push('Cleared', 'Log file cleared') },
      onExport: async () => {
        const r = await api.logsExport();
        if (!r.ok) toast.push('Export Failed', r.error || 'Canceled')
        else toast.push('Exported', String(r.filePath || ''))
      }
    })

    container.replaceChildren(viewer)
  }
}

