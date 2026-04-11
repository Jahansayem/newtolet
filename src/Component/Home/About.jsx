import banner from '../../assets/banner.jpg'
import { FaBuilding, FaUsers, FaAward, FaHandshake, FaCheckCircle, FaArrowRight } from 'react-icons/fa'

const About = () => {
    const stats = [
        { icon: <FaBuilding />, value: "500+", label: "Properties Listed" },
        { icon: <FaUsers />, value: "10K+", label: "Happy Customers" },
        { icon: <FaAward />, value: "15+", label: "Years Experience" },
        { icon: <FaHandshake />, value: "98%", label: "Client Satisfaction" }
    ]

    const features = [
        "Verified property listings with authentic photos",
        "Transparent pricing with no hidden fees",
        "24/7 customer support for all inquiries",
        "Secure payment processing and transactions"
    ]

    return (
        <section className="py-12 md:py-20 bg-gray-50">
            {/* Header Section */}
            <div className="text-center mb-10 md:mb-16 px-6 animate-fade-in-up">
                <div className="inline-flex items-center gap-2 bg-[#1E73B8]/10 text-[#1E73B8] px-4 py-2 rounded-full mb-4 hover-scale">
                    <FaBuilding />
                    <span className="text-sm font-medium">About Us</span>
                </div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800 mb-3">
                    Your Trusted Property Partner
                </h2>
                <p className="text-gray-500 max-w-lg mx-auto text-sm sm:text-base">
                    We connect property seekers with their dream homes through trust, transparency, and exceptional service.
                </p>
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto ">
                {/* Stats Section */}
                <div className="mt-5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger-children">
                        {stats.map((stat, index) => (
                            <div
                                key={index}
                                className="bg-white rounded-xl p-3 shadow-sm hover:shadow-xl transition-all duration-300 text-center group hover-lift"
                            >
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#1E73B8]/10 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-[#1E73B8]/20 group-hover:scale-110 transition-all duration-300">
                                    <span className="text-[#1E73B8] text-lg sm:text-xl">{stat.icon}</span>
                                </div>
                                <p className="text-2xl sm:text-3xl font-bold text-gray-800 mb-1">
                                    {stat.value}
                                </p>
                                <p className="text-xs sm:text-sm text-gray-500">
                                    {stat.label}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

               
            </div>
        </section>
    )
}

export default About
