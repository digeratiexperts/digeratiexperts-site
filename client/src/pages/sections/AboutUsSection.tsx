import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const checklistItems = [
  "Cyber Risk Scan",
  "Full Report",
  "Executive Consultation",
];

export const AboutUsSection = (): JSX.Element => {
  return (
    <section className="w-full flex items-center justify-center py-12 lg:py-20 px-4">
      <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-24 max-w-[1468px] w-full">
        <div className="flex flex-col w-full lg:w-[409.29px] items-center lg:items-start gap-8 lg:gap-[60px]">
          <div className="flex flex-col items-center lg:items-start gap-4 w-full text-center lg:text-left">
            <h2 className="font-normal text-[#020029] text-3xl sm:text-4xl lg:text-[52px] tracking-[0] leading-tight lg:leading-[73px]">
              Get a $20,000 Pen Test – Free
            </h2>

            <p className="font-normal text-[#020029bf] text-sm sm:text-base tracking-[0] leading-[26.4px]">
              Discover vulnerabilities before attackers do
              <br />– without paying a cent.
            </p>
          </div>

          <div className="flex flex-col w-full max-w-[306.8px] items-center lg:items-start gap-2.5">
            <img
              className="w-full"
              alt="Frame"
              src="/figmaAssets/frame-2131330691.svg"
            />

            <p className="font-normal text-[#020029bf] text-sm sm:text-base tracking-[0] leading-[26.4px] text-center lg:text-left">
              Trusted by 100+ Arizona
              <br />
              Businesses.
            </p>
          </div>
        </div>

        <Card className="w-full lg:w-auto bg-[#f0f3ff] rounded-[30px] shadow-[-11px_16px_32px_-9px_#0000001a] backdrop-blur-[23px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(23px)_brightness(100%)] border-0">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col w-full lg:w-[463.29px] items-end gap-2">
              <div className="flex flex-col items-start gap-[25px] w-full">
                <div className="flex flex-col items-start gap-[26px] w-full">
                  <div className="flex flex-col items-start gap-4 sm:gap-[30px] w-full">
                    <Input
                      placeholder="Full Name"
                      className="h-[50px] border-[#0000001f] rounded-[25px] border border-solid shadow-[inset_0px_1px_1px_#00000013] backdrop-blur-[15px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(15px)_brightness(100%)] bg-transparent font-normal text-[#c5c5c5] text-[13px] tracking-[0] leading-[normal] placeholder:text-[#c5c5c5]"
                      data-testid="input-fullname"
                    />

                    <Input
                      placeholder="Company"
                      className="h-[50px] border-[#0000001f] rounded-[25px] border border-solid shadow-[inset_0px_1px_1px_#00000013] backdrop-blur-[15px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(15px)_brightness(100%)] bg-transparent font-normal text-[#c5c5c5] text-[13px] tracking-[0] leading-[normal] placeholder:text-[#c5c5c5]"
                      data-testid="input-company"
                    />

                    <Input
                      placeholder="Email"
                      type="email"
                      className="h-[50px] border-[#0000001f] rounded-[25px] border border-solid shadow-[inset_0px_1px_1px_#00000013] backdrop-blur-[15px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(15px)_brightness(100%)] bg-transparent font-normal text-[#c5c5c5] text-[13px] tracking-[0] leading-[normal] placeholder:text-[#c5c5c5]"
                      data-testid="input-email"
                    />

                    <Input
                      placeholder="Phone (optional)"
                      type="tel"
                      className="h-[50px] border-[#0000001f] rounded-[25px] border border-solid shadow-[inset_0px_1px_1px_#00000013] backdrop-blur-[15px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(15px)_brightness(100%)] bg-transparent font-normal text-[#c5c5c5] text-[13px] tracking-[0] leading-[normal] placeholder:text-[#c5c5c5]"
                      data-testid="input-phone"
                    />
                  </div>

                  <Button 
                    className="h-12 w-full bg-[#5034ff] rounded-[100px] border border-solid hover:bg-[#5034ff]/90 px-4 py-2 gap-2"
                    data-testid="btn-schedule-meeting"
                  >
                    <span className="font-normal text-white text-sm sm:text-base tracking-[-0.32px] leading-6 whitespace-nowrap">
                      Schedule My 26-minute Meeting
                    </span>

                    <img
                      className="w-[60px] sm:w-[75.61px] h-6 sm:h-8 hidden sm:block"
                      alt="Frame"
                      src="/figmaAssets/frame-2131330617.svg"
                    />
                  </Button>
                </div>

                <div className="flex flex-col w-full sm:w-[200px] items-center sm:items-start justify-center gap-2 px-2.5 py-0">
                  {checklistItems.map((item, index) => (
                    <div
                      key={index}
                      className="relative w-[149px] h-[19px] [background:url(/figmaAssets/item-2.png)_50%_50%_/_cover]"
                    >
                      <div className="absolute top-[-3px] left-[31px] h-6 flex items-center justify-center font-normal text-[#020029bf] text-sm tracking-[0] leading-[23.8px] whitespace-nowrap">
                        {item}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="w-full lg:w-[455px] font-normal text-[#020029bf] text-xs sm:text-sm tracking-[0] leading-[23.8px] text-center lg:text-right">
                All information submitted is protected and handled in compliance
                with our Privacy Policy.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
