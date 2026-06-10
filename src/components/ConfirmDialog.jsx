function ConfirmDialog({ title, message, onConfirm, onCancel, confirmLabel }) {
  return (
    <div className="overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="confirm-dialog-actions">
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>{confirmLabel || 'Delete'}</button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
