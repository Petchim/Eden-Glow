import type { MouseEvent } from 'react';
import { ACADEMY as A } from '../data/academy.ts';
import { usePageMeta } from '../hooks/usePageMeta.ts';
import { BUSINESS } from '../config/business.ts';
import PageHero from '../components/PageHero.tsx';
import EnquiryForm from '../components/EnquiryForm.tsx';
import Faq from '../components/Faq.tsx';
import CtaBand from '../components/CtaBand.tsx';
import { Intro } from '../components/ServiceSections.tsx';
import Button from '../components/ui/Button.tsx';
import Img from '../components/ui/Img.tsx';
import Reveal from '../components/ui/Reveal.tsx';
import SectionTitle from '../components/ui/SectionTitle.tsx';
import { ACADEMY_IMAGES, HAIR_IMAGES, NAILS_IMAGES, LASH_IMAGES } from '../data/images.ts';

// Illustrative photography until real student work can be shared (with permission).
const STUDENT_GALLERY = [ACADEMY_IMAGES.intro, NAILS_IMAGES.manicure, LASH_IMAGES.technician, HAIR_IMAGES.occasion];

export default function Academy() {
  usePageMeta(A.meta.title, A.meta.description);
  const scrollTo = (id: string) => (e: MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <PageHero {...A.hero} crumb="Academy">
        <Button href="#academy-enquiry" arrow onClick={scrollTo('academy-enquiry')}>Training Enquiry</Button>
        <Button href="#courses" variant="line" onClick={scrollTo('courses')}>Course Areas</Button>
      </PageHero>

      <Intro data={A.intro} id="academy" />

      <section className="section section--alt" id="courses" aria-labelledby="courses-title">
        <div className="wrap">
          <div className="offer-head">
            <SectionTitle eyebrow="Course categories" lines={['Choose your', '*craft.*']} id="courses-title" />
            <Reveal delay={100} className="offer-intro">
              <p className="lede">Training areas planned for the academy. Course content, fees, duration, eligibility and certification will be confirmed before enrolment opens.</p>
            </Reveal>
          </div>
          <div className="acards">
            {A.categories.map((c, i) => (
              <Reveal as="article" className="acard" key={c.title} delay={(i % 3) * 90}>
                <div className="acard-img zoom-on-hover"><Img {...c.image} sizes="(max-width: 700px) 92vw, 30vw" /></div>
                <div className="acard-body">
                  <span className="o-num">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="o-title">{c.title}</h3>
                  <p className="o-text placeholder">{c.text}</p>
                  {c.status && <span className="tag">{c.status}</span>}
                </div>
              </Reveal>
            ))}
          </div>

          <div className="courses">
            <h3 className="mini-label">Course details</h3>
            {A.courses.map((c, i) => (
              <Reveal as="article" className="course" key={i} delay={i * 100}>
                <div className="course-head">
                  <span className="course-num">{String(i + 1).padStart(2, '0')}</span>
                  <h4 className="placeholder">{c.name}</h4>
                </div>
                <p className="placeholder course-info">{c.info}</p>
                <dl>
                  <div><dt>Duration</dt><dd className="placeholder">{c.duration}</dd></div>
                  <div><dt>Fee</dt><dd className="placeholder">{c.fee}</dd></div>
                  <div><dt>Eligibility</dt><dd className="placeholder">{c.eligibility}</dd></div>
                  <div><dt>Certificate</dt><dd className="placeholder">{c.certificate}</dd></div>
                </dl>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="academy-enquiry" aria-label="Training enquiry">
        <div className="wrap enq-grid">
          <div>
            <SectionTitle eyebrow="Register your interest" lines={['Start your', '*training journey.*']} id="enq-side-title" />
            <Reveal delay={100}>
              <p className="lede enq-lede">Tell us which area you’d like to learn and a little about your experience. The studio will reply with course details as soon as they’re available.</p>
            </Reveal>
          </div>
          <Reveal delay={120}>
            <EnquiryForm
              id="ac"
              title="Training enquiry"
              topicLabel="Course interest"
              topics={A.interests}
              greeting={`Hello ${BUSINESS.name}, I'd like to know more about the academy.`}
              subject={`Academy enquiry — ${BUSINESS.name}`}
              messagePlaceholder="Your current experience, preferred timings, and anything you’d like to know…"
            />
          </Reveal>
        </div>
      </section>

      <section className="section section--alt" aria-labelledby="students-title">
        <div className="wrap">
          <div className="gsection-head">
            <SectionTitle eyebrow="Student gallery" lines={['Work from', '*our students.*']} id="students-title" />
            <p className="fine students-note">Student work will be shared here, with permission, once courses begin. The photos below are illustrative stock images — not academy students.</p>
          </div>
          <ul className="students">
            {STUDENT_GALLERY.map((img, i) => (
              <Reveal as="li" key={img.src} delay={i * 80}>
                <Img {...img} sizes="(max-width: 700px) 46vw, 23vw" />
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <Faq items={A.faqs} id="academy-faq" />
      <CtaBand title={['Questions about', '*the academy?*']} text="Get in touch and the studio will be happy to help." label="Contact Us" to="/contact" />
    </>
  );
}
