import HomeHero from '../../components/user/home/HomeHero'
import QuickActions from '../../components/user/home/QuickActions'
import SpecialtySection from '../../components/user/home/SpecialtySection'
import DoctorSection from '../../components/user/home/DoctorSection'
import BookingSteps from '../../components/user/home/BookingSteps'
import AiTriageSection from '../../components/user/home/AiTriageSection'

export default function HomePage() {
    return (
        <div>
            <HomeHero />
            <QuickActions />
            <SpecialtySection />
            <DoctorSection />
            <BookingSteps />
            <AiTriageSection />
        </div>
    )
}
