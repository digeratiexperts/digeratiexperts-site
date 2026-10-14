using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Security.Principal;
using System.Windows.Forms;

namespace DETechTool {
    internal static class Program {
        [STAThread]
        private static int Main(string[] args) {
            bool check = args.Length == 1 && args[0] == "--check";
            bool storage = args.Length == 1 && args[0] == "--storage";
            if (args.Length > 0 && !check && !storage) return 2;
            try {
                string root = Path.GetDirectoryName(typeof(Program).Assembly.Location);
                string script = Path.Combine(root, @"console\DETechConsole.ps1");
                string powershell = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),
                    @"WindowsPowerShell\v1.0\powershell.exe");
                if (!Environment.Is64BitProcess || !File.Exists(script) || !File.Exists(powershell))
                    throw new InvalidOperationException("The complete 64-bit DE Tech Tool installation is required.");
                // Diagnostic path check only. The existing engine owns integrity, licensing and readiness.
                if (check) return 0;
                string arguments = "-NoProfile -NoLogo -Sta -WindowStyle Hidden -ExecutionPolicy Bypass -File \"" +
                    script + "\"" + (storage ? " -Page Storage" : "");
                ProcessStartInfo start = new ProcessStartInfo(powershell, arguments);
                start.WorkingDirectory = root;
                start.WindowStyle = ProcessWindowStyle.Hidden;
                bool elevated;
                using (WindowsIdentity identity = WindowsIdentity.GetCurrent()) {
                    elevated = new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator);
                }
                start.UseShellExecute = !elevated;
                start.CreateNoWindow = elevated;
                if (!elevated) start.Verb = "runas";
                try { using (Process child = Process.Start(start)) { if (child == null) return 2; } }
                catch (Win32Exception ex) {
                    if (ex.NativeErrorCode != 1223) throw;
                    // UAC declined: existing application gates changes and permits local audit.
                    start.UseShellExecute = false;
                    start.CreateNoWindow = true;
                    start.Verb = "";
                    using (Process child = Process.Start(start)) { if (child == null) return 2; }
                }
                return 0;
            } catch (Exception ex) {
                if (!check) MessageBox.Show(ex.Message, "DE Tech Tool could not start",
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 2;
            }
        }
    }
}
