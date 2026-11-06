"use client";
export default function StudioError({ reset }: { reset: () => void }) {
  return (
    <div className="studio-page">
      <div className="studio-empty" role="alert">
        <h1>Не получилось загрузить раздел</h1>
        <p>
          Проверьте соединение и попробуйте ещё раз. Уже сохранённые изменения
          останутся в студии.
        </p>
        <button className="studio-button" onClick={reset}>
          Повторить
        </button>
      </div>
    </div>
  );
}
