'use client'

import React, { useState } from 'react'
import { FiEye, FiEyeOff } from 'react-icons/fi'
import { useLanguage } from '../../i18n/useLanguage'

/**
 * Password field with a show/hide toggle. Accepts the same props as an <input>
 * (including a react-hook-form `register()` spread); the toggle is a sibling
 * button so the input keeps its own accessible name from the <label htmlFor>.
 */
const PasswordInput = React.forwardRef(function PasswordInput(
  { className = 'auth-input my-2', disabled = false, ...inputProps },
  ref
) {
  const { t } = useLanguage()
  const [visible, setVisible] = useState(false)

  return (
    <div className='relative'>
      <input
        ref={ref}
        {...inputProps}
        type={visible ? 'text' : 'password'}
        disabled={disabled}
        className={`${className} pr-12`}
      />
      <button
        type='button'
        onClick={() => setVisible((current) => !current)}
        aria-pressed={visible}
        aria-label={visible ? t('auth.aria.hidePassword') : t('auth.aria.showPassword')}
        className='auth-password-toggle'
        disabled={disabled}
      >
        {visible ? <FiEyeOff aria-hidden='true' /> : <FiEye aria-hidden='true' />}
      </button>
    </div>
  )
})

export default PasswordInput
