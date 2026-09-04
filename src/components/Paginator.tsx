import { For, Show } from "solid-js";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-solid";

interface PaginatorProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export default function Paginator(props: PaginatorProps) {
  const startItem = () => (props.currentPage - 1) * props.itemsPerPage + 1;
  const endItem = () => Math.min(props.currentPage * props.itemsPerPage, props.totalItems);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (props.totalPages <= 7) {
      // Show all pages if total is 7 or less
      for (let i = 1; i <= props.totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (props.currentPage <= 4) {
        // Show first 5 pages, then ellipsis, then last page
        for (let i = 2; i <= 5; i++) {
          pages.push(i);
        }
        pages.push("...");
        pages.push(props.totalPages);
      } else if (props.currentPage >= props.totalPages - 3) {
        // Show first page, ellipsis, then last 5 pages
        pages.push("...");
        for (let i = props.totalPages - 4; i <= props.totalPages; i++) {
          pages.push(i);
        }
      } else {
        // Show first page, ellipsis, current page area, ellipsis, last page
        pages.push("...");
        for (let i = props.currentPage - 1; i <= props.currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push("...");
        pages.push(props.totalPages);
      }
    }

    return pages;
  };

  return (
    <div
      class={`flex items-center justify-between bg-white dark:bg-gray-800 px-4 py-3 sm:px-6 border-t border-gray-200 dark:border-gray-700 ${props.className || ""}`}
    >
      {/* Mobile pagination */}
      <div class="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => props.currentPage > 1 && props.onPageChange(props.currentPage - 1)}
          disabled={props.currentPage === 1}
          class="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft class="w-4 h-4 mr-1" />
          Previous
        </button>
        <button
          onClick={() =>
            props.currentPage < props.totalPages && props.onPageChange(props.currentPage + 1)
          }
          disabled={props.currentPage === props.totalPages}
          class="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
          <ChevronRight class="w-4 h-4 ml-1" />
        </button>
      </div>

      {/* Desktop pagination */}
      <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p class="text-sm text-gray-700 dark:text-gray-300">
            Showing <span class="font-medium">{startItem()}</span> to{" "}
            <span class="font-medium">{endItem()}</span> of{" "}
            <span class="font-medium">{props.totalItems}</span> results
          </p>
        </div>
        <div>
          <nav
            class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
            aria-label="Pagination"
          >
            {/* Previous button */}
            <button
              onClick={() => props.currentPage > 1 && props.onPageChange(props.currentPage - 1)}
              disabled={props.currentPage === 1}
              class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span class="sr-only">Previous</span>
              <ChevronLeft class="w-5 h-5" />
            </button>

            {/* Page numbers */}
            <For each={getPageNumbers()}>
              {(page) => (
                <Show
                  when={typeof page === "number"}
                  fallback={
                    <span class="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300">
                      <MoreHorizontal class="w-4 h-4" />
                    </span>
                  }
                >
                  <button
                    onClick={() => props.onPageChange(page as number)}
                    class={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                      props.currentPage === page
                        ? "z-10 bg-blue-50 dark:bg-blue-900 border-blue-500 text-blue-600 dark:text-blue-400"
                        : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    {page}
                  </button>
                </Show>
              )}
            </For>

            {/* Next button */}
            <button
              onClick={() =>
                props.currentPage < props.totalPages && props.onPageChange(props.currentPage + 1)
              }
              disabled={props.currentPage === props.totalPages}
              class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span class="sr-only">Next</span>
              <ChevronRight class="w-5 h-5" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
