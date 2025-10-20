import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReactNode } from "react";

/**
 * A thin wrapper around shadcn <Table/> that guarantees mobile fitness.
 * Use className="table-fluid" on the <Table> to enforce wrapping and fixed layout.
 */
export function ResponsiveTable({
  header,
  rows,
  className = "",
}: {
  header: ReactNode;
  rows: ReactNode;
  className?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 overflow-hidden">
      <Table className={`table-fluid ${className}`}>
        {header}
        {rows}
      </Table>
    </div>
  );
}

/* usage example:

<ResponsiveTable
  header={
    <TableHeader>
      <TableRow>
        <TableHead>Όνομα</TableHead>
        <TableHead className="hide-sm">Email</TableHead>
        <TableHead>Ρόλος</TableHead>
        <TableHead className="hide-sm">Προεπισκόπηση</TableHead>
      </TableRow>
    </TableHeader>
  }
  rows={
    <TableBody>
      {users.map(u => (
        <TableRow key={u.id}>
          <TableCell>{u.name}</TableCell>
          <TableCell className="hide-sm">{u.email}</TableCell>
          <TableCell><span className="nowrap inline-flex rounded-full px-2 py-1 text-xs bg-gray-100">USER</span></TableCell>
          <TableCell className="hide-sm">{u.preview}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  }
/>

*/
