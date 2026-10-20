/**
 * Where the HTTP server listens.
 *
 * Under systemd socket activation the socket unit owns 127.0.0.1:3300 and
 * hands the listening fd to the service as fd 3 (sd_listen_fds: LISTEN_PID,
 * LISTEN_FDS). The socket stays open across `systemctl restart`, so requests
 * that arrive while the process is replaced queue in the kernel backlog and
 * are answered by the new process, instead of OpenLiteSpeed answering 503
 * for the restart window (deploy/vps/README.md, "Zero-downtime restarts").
 *
 * Without the socket unit (dev, CI smoke, a host that has not installed it)
 * nothing changes: the env is absent and the server binds the port itself.
 */
export type ListenTarget = { fd: number } | { port: number; host: string };

export const SD_LISTEN_FDS_START = 3;

export function resolveListenTarget(
  env: NodeJS.ProcessEnv,
  pid: number,
  fallback: { port: number; host: string },
): ListenTarget {
  const fds = Number.parseInt(env.LISTEN_FDS ?? "", 10);
  const forPid = Number.parseInt(env.LISTEN_PID ?? "", 10);
  // systemd sets LISTEN_PID to the service's own pid; an inherited value from
  // a parent (or a stale one) must not make us listen on a stranger's fd.
  if (Number.isInteger(fds) && fds >= 1 && forPid === pid) {
    return { fd: SD_LISTEN_FDS_START };
  }
  return fallback;
}

export function describeListenTarget(target: ListenTarget): string {
  return "fd" in target ? `systemd socket (fd ${target.fd})` : `http://${target.host}:${target.port}`;
}
