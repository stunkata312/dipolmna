function StarRating({ rating }) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  return (
    <span className="stars" title={`${rating} / 5`}>
      {'★'.repeat(fullStars)}
      {hasHalf && '★'}
      <span className="empty">{'★'.repeat(emptyStars)}</span>
      <span style={{ marginLeft: '6px', color: '#555', fontSize: '0.9rem' }}>
        {rating.toFixed(1)}
      </span>
    </span>
  );
}

export default StarRating;
