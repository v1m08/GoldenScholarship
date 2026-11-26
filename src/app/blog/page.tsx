import { redirect } from "next/navigation";

// The list of posts lives on the Why page.
export default function Blog() {
  redirect("/why#blog");
}
