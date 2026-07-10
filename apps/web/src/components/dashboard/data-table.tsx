"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { T } from "gt-next/client";
import type React from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  emptyMessage: React.ReactNode;
  isLoading?: boolean;
  loadingMessage?: React.ReactNode;
  pageSize?: number;
  pagination?:
    | { type: "client" }
    | {
        type: "cursor";
        canPrevious: boolean;
        canNext: boolean;
        onPrevious: () => void;
        onNext: () => void;
        pending?: boolean;
      }
    | { type: "none" };
  getRowClassName?: (row: TData) => string | undefined;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  emptyMessage,
  isLoading = false,
  loadingMessage = <T>Loading...</T>,
  pageSize = 10,
  pagination = { type: "client" },
  getRowClassName,
}: DataTableProps<TData, TValue>) {
  const clientPagination = pagination.type === "client";
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: clientPagination ? getPaginationRowModel() : undefined,
    initialState: {
      pagination: {
        pageSize,
      },
    },
  });
  const visibleRows = table.getRowModel().rows;
  const showPagination =
    clientPagination &&
    !isLoading &&
    data.length > pageSize &&
    (table.getCanPreviousPage() || table.getCanNextPage());

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  {loadingMessage}
                </TableCell>
              </TableRow>
            ) : visibleRows.length ? (
              visibleRows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(getRowClassName?.(row.original))}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {showPagination ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <T>Previous</T>
          </Button>
          <div className="text-sm text-muted-foreground">
            <T>Page</T> {table.getState().pagination.pageIndex + 1} <T>of</T>{" "}
            {table.getPageCount()}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <T>Next</T>
          </Button>
        </div>
      ) : pagination.type === "cursor" &&
        (pagination.canPrevious || pagination.canNext) ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={pagination.onPrevious}
            disabled={!pagination.canPrevious || pagination.pending}
          >
            <T>Previous</T>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={pagination.onNext}
            disabled={!pagination.canNext || pagination.pending}
          >
            <T>Next</T>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
