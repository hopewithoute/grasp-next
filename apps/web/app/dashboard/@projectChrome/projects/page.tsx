// Explicitly clears the project chrome on the projects index during soft
// navigation. `default.tsx` covers hard loads, but parallel routes can retain
// the previous slot payload when navigating back from a project detail.
export default function ProjectChromeProjectsIndex() {
  return null;
}
