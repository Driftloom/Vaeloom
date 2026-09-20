import React from 'react';
import { DataTable, ColumnDef } from '@vaeloom/ui-kit';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
}

export function Table<T>({ columns, data, keyExtractor, onRowClick, emptyMessage }: TableProps<T>) {
  const tableColumns: ColumnDef<T>[] = columns.map((col) => ({
    key: col.key,
    header: col.header,
    sortable: col.sortable,
    className: col.className,
    render: (_val: any, row: T) => (col.render ? col.render(row) : (row as any)[col.key]),
  }));

  return (
    <DataTable
      columns={tableColumns}
      data={data}
      keyExtractor={keyExtractor}
      onRowClick={onRowClick}
      emptyMessage={emptyMessage}
    />
  );
}
