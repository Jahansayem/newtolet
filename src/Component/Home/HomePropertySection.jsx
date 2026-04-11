'use client'

import React from 'react'
import Listprovaider from '../Route/Listprovaider'
import Propertylist from '../Navber/Propertylist'

const HomePropertySection = () => {
  return (
    <Listprovaider queryOptions={{ limit: 20 }}>
      <Propertylist />
    </Listprovaider>
  )
}

export default HomePropertySection
