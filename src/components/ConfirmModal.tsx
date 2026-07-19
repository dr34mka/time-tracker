import Modal from './Modal';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}

/** Подтверждение опасного действия — вместо нативного confirm() */
export default function ConfirmModal({ title, message, confirmLabel = 'Удалить', onConfirm, onClose }: Props) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="hint" style={{ margin: '0 0 8px', fontSize: 13 }}>{message}</p>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>
          Отмена
        </button>
        <button
          className="btn btn-red"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
