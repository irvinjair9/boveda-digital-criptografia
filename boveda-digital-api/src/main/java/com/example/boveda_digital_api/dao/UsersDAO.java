package com.example.boveda_digital_api.dao;

import com.example.boveda_digital_api.entity.UsersEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UsersDAO extends JpaRepository<UsersEntity, Long> {
    Optional<UsersEntity> findByUsername(String username);
}
