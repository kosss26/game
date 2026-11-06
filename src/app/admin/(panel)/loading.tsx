export default function StudioLoading() {
  return (
    <div
      className="studio-page studio-loading"
      aria-busy="true"
      aria-label="Загрузка студии"
    >
      <div className="skeleton" />
      <div className="studio-stats">
        {[0, 1, 2, 3].map((n) => (
          <div className="skeleton" key={n} />
        ))}
      </div>
      <div className="skeleton" />
    </div>
  );
}
