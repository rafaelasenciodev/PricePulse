import type { ReactNode } from "react";
import { Link, Navigate, type To } from "react-router-dom";
import type { Page } from "../api";
import { screens } from "../texts";
import { buttonClasses } from "./Button";

/** How many items a list shows at a time. The API allows up to 100. */
export const PAGE_SIZE = 20;

/** The page asked for in `?page=`. What is not a whole number from 1 is the first page. */
export function pageFrom(value: string | null): number {
  if (value === null || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 1;
}

interface Props {
  readonly page: number;
  readonly data: Page<unknown>;
  /** The name of the group of links, for somebody who reads the page with a screen reader. */
  readonly label: string;
  /** The address of a page of this same list, which keeps whatever else the address has. */
  readonly addressOf: (page: number) => To;
  /** The items of the page. */
  readonly children: ReactNode;
}

/**
 * A list that is read one page at a time: the line that says which items are shown, the items, and the links to the
 * page before and the page after. A page that is past the end, such as an old address, leads to the last one, which
 * is the nearest page that exists. The caller handles an empty list, which has no pages.
 */
export function Pager({ page, data, label, addressOf, children }: Props) {
  const { items, total, offset } = data;
  if (items.length === 0) return <Navigate to={addressOf(Math.max(1, Math.ceil(total / PAGE_SIZE)))} replace />;
  return (
    <>
      <p className="mb-4 text-sm text-muted">{screens.paging.range(offset + 1, offset + items.length, total)}</p>
      {children}
      <nav aria-label={label} className="mt-6 flex gap-3">
        {page > 1 && (
          <Link to={addressOf(page - 1)} className={`${buttonClasses("secondary")} no-underline`}>
            {screens.paging.previous}
          </Link>
        )}
        {offset + items.length < total && (
          <Link to={addressOf(page + 1)} className={`${buttonClasses("secondary")} no-underline`}>
            {screens.paging.next}
          </Link>
        )}
      </nav>
    </>
  );
}
