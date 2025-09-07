export default function ImageModal({ open, imgUrl, onClose }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card image-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Inspiration Image</h2>
        {imgUrl ? <img src={imgUrl} alt="Inspo" className="inspo-preview" /> : <p className="modal-body">No image available</p>}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
