import type { ReactNode } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

export function StudioHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="studio-heading">
      <div>
        {eyebrow && <p className="studio-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="studio-description">{description}</p>}
      </div>
      {action}
    </header>
  );
}

export function StudioStatus({
  published,
  children,
}: {
  published: boolean;
  children?: ReactNode;
}) {
  return (
    <span
      className={`studio-status ${published ? "is-published" : "is-draft"}`}
    >
      <span />
      {children || (published ? "Опубликовано" : "Черновик")}
    </span>
  );
}

export function StudioBack({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link className="studio-back" href={href}>
      <Icon name="back" size={16} />
      {children}
    </Link>
  );
}

export function StudioStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="studio-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}

export function StudioEmpty({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="studio-empty">
      <span className="studio-empty-icon">
        <Icon name="book" size={26} />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </div>
  );
}
