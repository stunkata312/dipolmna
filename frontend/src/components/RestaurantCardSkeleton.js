function RestaurantCardSkeleton() {
  return (
    <div className="restaurant-card skeleton-card" aria-hidden="true">
      <div className="restaurant-card-image skeleton-shimmer" />
      <div className="restaurant-card-body">
        <div className="skeleton-line skeleton-shimmer skeleton-line-title" />
        <div className="skeleton-line skeleton-shimmer skeleton-line-sub" />
        <div className="skeleton-line skeleton-shimmer skeleton-line-stars" />
      </div>
    </div>
  );
}

export default RestaurantCardSkeleton;
