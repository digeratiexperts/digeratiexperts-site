import { StarIcon } from "lucide-react";
import React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";

const faqData = [
  {
    id: "item-1",
    question: "What is your best service?",
    answer:
      "Evaluate your business size, needs, and goals. Our Basic plan is great for small businesses, while Pro and Elite are designed for larger teams and advanced requirements.",
    isOpen: true,
  },
  {
    id: "item-2",
    question: "How do I choose the right plan for my business?",
    answer: "",
    isOpen: false,
  },
  {
    id: "item-3",
    question: "Can I customize the solutions?",
    answer: "",
    isOpen: false,
  },
  {
    id: "item-4",
    question: "What is your best service?",
    answer: "",
    isOpen: false,
  },
  {
    id: "item-5",
    question: "Is my data secure?",
    answer: "",
    isOpen: false,
  },
];

const testimonialData = {
  rating: 5,
  text: "Digerati delivered beyond our expectations. Their encryption protocols and risk assessments helped us meet strict compliance standards with ease.",
  customerName: "James Tores",
  customerRole: "CLIENT OF AGENCY",
  customerImage: "/figmaAssets/image-24-png-7.png",
};

export const MainContentSection = (): JSX.Element => {
  return (
    <section className="flex flex-col w-full items-start gap-2.5 px-4 md:px-8 lg:px-[120px] py-12 md:py-16 lg:py-[100px] relative [background:url(/figmaAssets/background-1.png)_50%_50%_/_cover,linear-gradient(0deg,rgba(3,2,40,1)_0%,rgba(3,2,40,1)_100%)]">
      <div className="flex flex-col items-start gap-12 md:gap-16 lg:gap-[100px] relative self-stretch w-full flex-[0_0_auto]">
        <div className="flex flex-col lg:flex-row items-start gap-8 lg:gap-[125px] relative self-stretch w-full flex-[0_0_auto]">
          <div className="inline-flex flex-col items-start justify-center gap-[19px] relative flex-[0_0_auto] w-full lg:w-auto">
            <div className="relative flex items-center justify-center self-stretch h-6 mt-[-1.00px] font-normal text-white text-lg md:text-xl tracking-[-0.70px] leading-6">
              FREQUENTLY ASKED QUESTIONS
            </div>

            <div className="relative flex items-center justify-center w-full lg:w-[465px] font-normal text-white text-3xl md:text-4xl lg:text-[52px] tracking-[0] leading-tight md:leading-[73px]">
              Find answers to common queries about us.
            </div>
          </div>

          <div className="relative w-full lg:w-[610px]">
            <Accordion
              type="single"
              collapsible
              defaultValue="item-1"
              className="w-full"
            >
              {faqData.map((faq) => (
                <AccordionItem
                  key={faq.id}
                  value={faq.id}
                  className="border-b border-[#ffd75a] mb-[10px]"
                >
                  <AccordionTrigger className="flex items-center justify-between py-[20px] px-2.5 hover:no-underline [&[data-state=open]>svg]:rotate-180">
                    <span className="font-medium text-white text-[28px] tracking-[0] leading-[33.6px] text-left">
                      {faq.question}
                    </span>
                  </AccordionTrigger>
                  {faq.answer && (
                    <AccordionContent className="px-2.5 pb-[20px]">
                      <div className="font-normal text-white text-xl tracking-[0] leading-7">
                        {faq.answer}
                      </div>
                    </AccordionContent>
                  )}
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>

        <div className="relative self-stretch w-full">
          <div className="flex flex-col lg:flex-row items-start gap-8 lg:gap-[125px] relative self-stretch w-full">
            <div className="flex flex-col items-start gap-5">
              <div className="relative flex items-center gap-[10px]">
                <img
                  className="w-[54px] h-[68px]"
                  alt="Image"
                  src="/figmaAssets/image.png"
                />
                <div className="[font-family:'Cabin',Helvetica] font-semibold text-white text-[50px] tracking-[-1.75px] leading-[60px] whitespace-nowrap">
                  Real Stories
                </div>
              </div>

              <div className="[font-family:'Cabin',Helvetica] font-semibold text-[50px] tracking-[-1.75px] leading-[60px]">
                <span className="text-white tracking-[-0.88px]">from </span>
                <span className="text-[#ffc107] tracking-[-0.88px]">
                  Satisfied
                </span>
                <br />
                <span className="text-white tracking-[-0.88px]">Customers</span>
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-[18px]">
              <Card className="bg-[#f0f3ff] rounded-xl border border-solid border-[#333333] backdrop-blur-2xl backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(40px)_brightness(100%)]">
                <CardContent className="p-[35px]">
                  <div className="flex items-center justify-between mb-[20px]">
                    <div className="font-medium text-[#020029] text-[19px] tracking-[0] leading-[28.5px]">
                      5 - StarIcon Rating
                    </div>
                    <div className="flex gap-1">
                      {[...Array(testimonialData.rating)].map((_, index) => (
                        <StarIcon
                          key={index}
                          className="w-[21px] h-[21px] fill-[#ffc107] text-[#ffc107]"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="[font-family:'Roboto',Helvetica] font-normal text-[#020029] text-sm tracking-[0] leading-[21px] mb-[20px]">
                    {testimonialData.text}"
                  </div>

                  <div className="flex items-center gap-[20px]">
                    <Avatar className="w-[67px] h-[68px]">
                      <AvatarImage
                        src={testimonialData.customerImage}
                        alt={testimonialData.customerName}
                      />
                    </Avatar>
                    <div className="flex flex-col gap-[0.5px]">
                      <div className="font-medium text-[#020029] text-[17px] leading-[25.5px] tracking-[0]">
                        {testimonialData.customerName}
                      </div>
                      <div className="font-normal text-[#02002940] text-[15px] tracking-[0] leading-[22.5px]">
                        {testimonialData.customerRole}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-center justify-start gap-[10px]">
                <div className="w-[35px] h-[35px] rounded-full bg-[#ffd75a]" />
                <div className="w-[35px] h-[35px] rounded-full bg-white/30" />
                <div className="w-[35px] h-[35px] rounded-full bg-white/30" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
