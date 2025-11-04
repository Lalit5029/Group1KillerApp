import React from "react";
import { cn } from "@/lib/utils";

interface ListProps extends React.HTMLAttributes<HTMLUListElement> {
  className?: string;
  children: React.ReactNode;
}

interface ListItemProps extends React.HTMLAttributes<HTMLLIElement> {
  className?: string;
  children: React.ReactNode;
}

const List = React.forwardRef<HTMLUListElement, ListProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <ul
        ref={ref}
        className={cn("list-none space-y-2", className)}
        {...props}
      >
        {children}
      </ul>
    );
  }
);

const ListItem = React.forwardRef<HTMLLIElement, ListItemProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <li
        ref={ref}
        className={cn("py-1 border-b border-gray-100 last:border-0", className)}
        {...props}
      >
        {children}
      </li>
    );
  }
);

List.displayName = "List";
ListItem.displayName = "ListItem";

// Add Item as a property of List
(List as any).Item = ListItem;

export { List }; 