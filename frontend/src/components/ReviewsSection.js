import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../api/client';
import StarRating from './StarRating';

function formatRelative(iso) {
  const d = new Date(iso.replace(' ', 'T') + (iso.endsWith('Z') ? '' : 'Z'));
  const now = new Date();
  const diff = Math.round((now - d) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)}d ago`;
  return new Date(iso.replace(' ', 'T')).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  return (
    <div className="star-picker" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          className={`star-picker-btn${display >= n ? ' is-filled' : ''}`}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function ReviewsSection({ restaurantId, ownerId }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitErr, setSubmitErr] = useState(null);
  const [submitOk, setSubmitOk] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingMine, setEditingMine] = useState(false);
  const formRef = useRef(null);
  const textareaRef = useRef(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['restaurant', restaurantId, 'reviews'],
    queryFn: () => apiFetch(`/restaurants/${restaurantId}/reviews`),
    enabled: !!restaurantId,
  });

  const submit = useMutation({
    mutationFn: (body) => apiFetch(`/restaurants/${restaurantId}/reviews`, { method: 'POST', body }),
    onSuccess: () => {
      setSubmitOk('Thanks for your review!');
      setSubmitErr(null);
      setRating(0);
      setComment('');
      setEditingMine(false);
      setConfirmDelete(false);
      queryClient.invalidateQueries({ queryKey: ['restaurant', restaurantId, 'reviews'] });
      queryClient.invalidateQueries({ queryKey: ['restaurant', String(restaurantId)] });
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
    },
    onError: (err) => { setSubmitErr(err.message); setSubmitOk(null); },
  });

  const remove = useMutation({
    mutationFn: () => apiFetch(`/restaurants/${restaurantId}/reviews/me`, { method: 'DELETE' }),
    onSuccess: () => {
      setSubmitOk('Review deleted');
      setSubmitErr(null);
      setRating(0);
      setComment('');
      setConfirmDelete(false);
      setEditingMine(false);
      queryClient.invalidateQueries({ queryKey: ['restaurant', restaurantId, 'reviews'] });
      queryClient.invalidateQueries({ queryKey: ['restaurant', String(restaurantId)] });
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
    },
    onError: (err) => { setSubmitErr(err.message); setSubmitOk(null); },
  });

  // Pre-fill if user already reviewed
  const myReview = data?.reviews?.find(r => r.user_id === user?.id);
  const canReview = !!user && user.id !== ownerId && user.role !== 'restaurant';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      setSubmitErr('Please pick a rating from 1 to 5 stars');
      return;
    }
    submit.mutate({ rating, comment });
  };

  const handleRedact = (review) => {
    setRating(review.rating || 0);
    setComment(review.comment || '');
    setEditingMine(true);
    setConfirmDelete(false);
    setSubmitErr(null);
    setSubmitOk(null);
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => {
      if (textareaRef.current) textareaRef.current.focus();
    }, 250);
  };

  if (isLoading) return <div className="detail-card"><h3 className="detail-card-title">Reviews</h3><div className="loading">Loading reviews…</div></div>;
  if (error) return <div className="detail-card"><h3 className="detail-card-title">Reviews</h3><div className="error-message">Failed to load reviews</div></div>;

  const stats = data?.stats || { total: 0, avg: 0, counts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
  const reviews = data?.reviews || [];
  // Pin the current user's own review to the top so they don't have to hunt for it
  const orderedReviews = user
    ? [...reviews.filter(r => r.user_id === user.id), ...reviews.filter(r => r.user_id !== user.id)]
    : reviews;
  const totalForBars = Math.max(1, stats.total);

  return (
    <div className="detail-card reviews-card">
      <h3 className="detail-card-title">Reviews</h3>

      {/* Summary */}
      <div className="reviews-summary">
        <div className="reviews-avg">
          <span className="reviews-avg-num">{stats.total > 0 ? stats.avg.toFixed(1) : '–'}</span>
          <StarRating rating={stats.avg} />
          <span className="reviews-count">
            {stats.total} {stats.total === 1 ? 'review' : 'reviews'}
          </span>
        </div>
        <div className="reviews-dist">
          {[5, 4, 3, 2, 1].map(stars => {
            const count = stats.counts[stars] || 0;
            const pct = (count / totalForBars) * 100;
            return (
              <div key={stars} className="dist-row">
                <span className="dist-label">{stars}★</span>
                <div className="dist-bar">
                  <div className="dist-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="dist-count">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Leave your review */}
      {canReview && (
        <div className="leave-review" ref={formRef}>
          <h4 className="leave-review-title">{myReview ? 'Edit your review' : 'Leave your review'}</h4>
          <form onSubmit={handleSubmit}>
            <StarPicker value={rating} onChange={(v) => { setRating(v); setSubmitErr(null); setSubmitOk(null); }} />
            <textarea
              ref={textareaRef}
              className="leave-review-textarea"
              placeholder={myReview ? 'Update your review…' : 'Share your experience…'}
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={3}
              maxLength={1000}
            />
            <div className="leave-review-actions">
              <button type="submit" className="submit-btn submit-btn-compact" disabled={submit.isPending || remove.isPending || rating === 0}>
                {submit.isPending ? 'Saving…' : myReview ? 'Update review' : 'Submit review'}
              </button>
              {myReview && editingMine && !confirmDelete && (
                <button
                  type="button"
                  className="delete-review-btn"
                  onClick={() => setConfirmDelete(true)}
                  disabled={submit.isPending || remove.isPending}
                >
                  Delete
                </button>
              )}
              {myReview && editingMine && confirmDelete && (
                <div className="confirm-cancel">
                  <span>Delete your review?</span>
                  <button
                    type="button"
                    className="confirm-yes"
                    onClick={() => remove.mutate()}
                    disabled={remove.isPending}
                  >
                    {remove.isPending ? 'Deleting…' : 'Yes'}
                  </button>
                  <button
                    type="button"
                    className="confirm-no"
                    onClick={() => setConfirmDelete(false)}
                    disabled={remove.isPending}
                  >
                    No
                  </button>
                </div>
              )}
            </div>
            {submitErr && <div className="form-feedback error-message">{submitErr}</div>}
            {submitOk && <div className="form-feedback success-message">{submitOk}</div>}
          </form>
        </div>
      )}

      {!canReview && !user && (
        <div className="leave-review leave-review-empty">
          <p>Sign in to leave a review.</p>
        </div>
      )}

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <p className="reviews-empty">No reviews yet. Be the first to share your experience!</p>
      ) : (
        <div className="reviews-list">
          {orderedReviews.map(r => {
            const isMine = !!user && r.user_id === user.id;
            return (
              <div key={r.id} className="review-item">
                {isMine && (
                  <button
                    type="button"
                    className="review-redact-btn"
                    onClick={() => handleRedact(r)}
                    title="Edit your review"
                  >
                    Redact
                  </button>
                )}
                <div className="review-head">
                  {r.avatar_url ? (
                    <img src={r.avatar_url} alt="" className="review-avatar" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="review-avatar review-avatar-initials">
                      {(r.user_name || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="review-meta">
                    <strong>{r.user_name || 'Anonymous'}</strong>
                    <div className="review-meta-row">
                      <StarRating rating={r.rating} />
                      <span className="review-date">{formatRelative(r.created_at)}</span>
                    </div>
                  </div>
                </div>
                {r.comment && <p className="review-comment">{r.comment}</p>}
                {r.owner_reply && r.owner_reply.trim() && (
                  <div className="review-owner-reply">
                    <div className="review-owner-reply-head">
                      <strong>Reply from the restaurant</strong>
                      {r.owner_reply_at && (
                        <span className="review-date">{formatRelative(r.owner_reply_at)}</span>
                      )}
                    </div>
                    <p className="review-owner-reply-text">{r.owner_reply}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ReviewsSection;
