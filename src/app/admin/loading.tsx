import { LoadingBlock } from "@/components/ui";

export default function AdminLoading() {
  return <LoadingBlock shape="lines" count={6} label="Chargement de l'administration…" />;
}
