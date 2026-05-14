import { Toaster } from "sonner";

/** Global snackbars — mount once next to app providers. */
export function AppToaster() {
  return (
    <Toaster
      theme="dark"
      richColors
      closeButton
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            "group !border-zinc-700 !bg-zinc-900 !text-zinc-100 shadow-lg",
          title: "!text-zinc-100",
          description: "!text-zinc-400",
          actionButton: "!bg-zinc-800 !text-zinc-100",
          cancelButton: "!bg-zinc-800 !text-zinc-300",
        },
      }}
    />
  );
}
