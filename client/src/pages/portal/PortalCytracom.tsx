import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PortalLayout } from "./PortalLayout";
import { Phone, Download, CheckCircle, Settings, Headphones, Volume2, Mic, PhoneCall, PhoneOff, Users, Clock } from "lucide-react";
import { PRIMARY_PHONE } from "@/data/companyContact";

/** Light Quick Actions: navy type on white, magenta fill so hover white type has contrast. */
const quickActionClass =
  "border-[#D3126A]/40 bg-white text-[#1A1228] hover:bg-[#D3126A] hover:border-[#D3126A] hover:text-white dark:bg-transparent dark:text-white dark:hover:bg-[#D3126A] dark:hover:text-white";

interface CallHistory {
  id: string;
  type: "inbound" | "outbound" | "missed";
  number: string;
  contact: string;
  duration: string;
  time: string;
}

const recentCalls: CallHistory[] = [
  { id: "1", type: "outbound", number: "+1 (480) 555-1234", contact: "John Smith", duration: "5:32", time: "10 mins ago" },
  { id: "2", type: "inbound", number: "+1 (602) 555-5678", contact: "Sarah Johnson", duration: "12:15", time: "1 hour ago" },
  { id: "3", type: "missed", number: "+1 (480) 555-9012", contact: "Unknown", duration: "-", time: "2 hours ago" },
  { id: "4", type: "outbound", number: "+1 (623) 555-3456", contact: "Mike Wilson", duration: "3:45", time: "Yesterday" },
];

export default function PortalCytracom() {
  const [extension, setExtension] = useState("1001");
  const [voicemailPin, setVoicemailPin] = useState("");

  const handleSaveSettings = () => {
    alert("Settings saved successfully!");
  };

  return (
    <PortalLayout title="Cytracom Phone">
      <div className="space-y-6">
        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Phone className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Phone Status</p>
                  <p className="text-xl font-bold text-green-600">Online</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Extension</p>
                  <p className="text-xl font-bold">x{extension}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <PhoneCall className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Today's Calls</p>
                  <p className="text-xl font-bold">12</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <Volume2 className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Voicemails</p>
                  <p className="text-xl font-bold">3 new</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Download Softphone */}
        <Card>
          <CardHeader>
            <CardTitle>Download Cytracom Softphone</CardTitle>
            <CardDescription>Install the Cytracom app for desktop and mobile calling</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" data-testid="button-download-windows">
                <Headphones className="h-8 w-8" />
                <span>Windows</span>
                <span className="text-xs text-gray-500">Desktop App</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" data-testid="button-download-mac">
                <Headphones className="h-8 w-8" />
                <span>macOS</span>
                <span className="text-xs text-gray-500">Desktop App</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" data-testid="button-download-ios">
                <Phone className="h-8 w-8" />
                <span>iOS</span>
                <span className="text-xs text-gray-500">App Store</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" data-testid="button-download-android">
                <Phone className="h-8 w-8" />
                <span>Android</span>
                <span className="text-xs text-gray-500">Play Store</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Phone Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Phone Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="extension">Extension Number</Label>
                <Input 
                  id="extension" 
                  value={extension} 
                  onChange={(e) => setExtension(e.target.value)}
                  data-testid="input-extension"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="voicemail-pin">Voicemail PIN</Label>
                <Input 
                  id="voicemail-pin" 
                  type="password"
                  value={voicemailPin} 
                  onChange={(e) => setVoicemailPin(e.target.value)}
                  placeholder="Enter new PIN"
                  data-testid="input-voicemail-pin"
                />
              </div>
              <div className="flex items-center gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <Mic className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">Microphone: Default</span>
                </div>
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">Speaker: Default</span>
                </div>
              </div>
              <Button onClick={handleSaveSettings} className="w-full bg-[#D3126A] hover:bg-[#e01874]" data-testid="button-save-settings">
                Save Settings
              </Button>
            </CardContent>
          </Card>

          {/* Recent Calls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Calls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentCalls.map((call) => (
                  <div 
                    key={call.id}
                    className="flex items-center justify-between p-3 border dark:border-slate-700 rounded-lg"
                    data-testid={`call-${call.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        call.type === 'inbound' ? 'bg-green-100 dark:bg-green-900/30' :
                        call.type === 'outbound' ? 'bg-blue-100 dark:bg-blue-900/30' :
                        'bg-red-100 dark:bg-red-900/30'
                      }`}>
                        {call.type === 'missed' ? (
                          <PhoneOff className="h-4 w-4 text-red-600" />
                        ) : (
                          <PhoneCall className={`h-4 w-4 ${call.type === 'inbound' ? 'text-green-600' : 'text-blue-600'}`} />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{call.contact}</p>
                        <p className="text-xs text-gray-500">{call.number}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className={
                        call.type === 'missed' ? 'border-red-200 text-red-600' : ''
                      }>
                        {call.type === 'missed' ? 'Missed' : call.duration}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">{call.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="border-[#D3126A]/20 bg-gradient-to-r from-[#D3126A]/10 to-blue-500/10 text-[#1A1228] dark:text-white">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button variant="outline" className={quickActionClass} data-testid="button-check-voicemail">
                <Volume2 className="h-4 w-4 mr-2" />
                Check Voicemail
              </Button>
              <Button variant="outline" className={quickActionClass} data-testid="button-update-greeting">
                <Mic className="h-4 w-4 mr-2" />
                Update Greeting
              </Button>
              <Button variant="outline" className={quickActionClass} data-testid="button-call-forwarding">
                <Phone className="h-4 w-4 mr-2" />
                Call Forwarding
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Help */}
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900 dark:text-blue-100">Cytracom Phone Support</p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  For phone system issues, check our <a href="/portal/kb" className="underline">Knowledge Base</a> or 
                  contact support at <strong>support@digeratiexperts.com</strong>. For urgent issues, call <strong>{PRIMARY_PHONE.display}</strong>.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
