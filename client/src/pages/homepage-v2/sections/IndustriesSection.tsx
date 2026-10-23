import lawScalesImage from "@assets/Rectangle-152058-1_1767027918697.webp";
import healthcareImage from "@assets/Rectangle-152058-2_1767027918698.webp";
import realEstateImage from "@assets/Rectangle-152058-3_1767027918698.webp";
import animalHospitalImage from "@assets/Rectangle-152058-4_1767027918698.webp";
import cpaImage from "@/assets/industries/cpa-calculator-2026-10-06.webp";

const INDUSTRIES = [
  { title: "Law firms", text: "Protect client privilege and meet ABA requirements.", image: lawScalesImage, href: "/industries/law-firms", cta: "View law firms" },
  { title: "CPA firms", text: "Secure tax data and meet IRS/FTC requirements.", image: cpaImage, href: "/industries/accounting-finance", cta: "View CPA firms" },
  { title: "Medical practices", text: "HIPAA-aligned controls and patient data protection.", image: healthcareImage, href: "/industries/healthcare", cta: "View medical practices" },
  { title: "Real estate firms", text: "Wire fraud prevention and transaction security.", image: realEstateImage, href: "/industries/real-estate", cta: "View real estate firms" },
  { title: "Animal hospitals", text: "Veterinary practice and client data protection.", image: animalHospitalImage, href: "/industries/animal-hospitals", cta: "View animal hospitals" },
];

export function IndustriesSection(): JSX.Element {
  return (
    <section className="sec t-store" id="industries">
      <div className="wrap">
        <div className="head">
          <div>
            <p className="mark">Specialized solutions</p>
            <h2>Industries we serve.</h2>
          </div>
          <div className="links">
            <p className="lede">Cybersecurity built around how Arizona's essential sectors actually work.</p>
            <a className="link" href="/industries">Browse all industries</a>
          </div>
        </div>
        <div className="ind">
          {INDUSTRIES.map((industry) => (
            <a href={industry.href} key={industry.title}>
              <img src={industry.image} alt="" />
              <h3>{industry.title}</h3>
              <p>{industry.text}</p>
              <span>{industry.cta}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
